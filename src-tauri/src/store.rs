//! Immutable book bytes and transactional catalog records have independent lifetimes.
use rusqlite::{Connection, params};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{
    collections::HashMap,
    fs,
    io::Write,
    path::{Path, PathBuf},
    sync::{
        Mutex,
        atomic::{AtomicU32, Ordering},
    },
};
use tempfile::NamedTempFile;

pub struct Library {
    pub root: PathBuf,
    db: Mutex<Connection>,
    uploads: Mutex<HashMap<u32, Upload>>,
    next_upload: AtomicU32,
}

struct Upload {
    file: NamedTempFile,
    hash: Sha256,
    written: u64,
    expected: u64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Record {
    pub key: String,
    pub value: String,
    pub version: i64,
}
#[derive(Deserialize)]
pub struct Change {
    pub key: String,
    pub value: String,
    pub expected: i64,
}
type Result<T> = std::result::Result<T, String>;
fn err(e: impl std::fmt::Display) -> String {
    e.to_string()
}

impl Library {
    pub fn open(root: &Path) -> Result<Self> {
        fs::create_dir_all(root.join("objects")).map_err(err)?;
        let db = Connection::open(root.join("catalog.sqlite3")).map_err(err)?;
        let version: i64 = db
            .pragma_query_value(None, "user_version", |r| r.get(0))
            .map_err(err)?;
        if version > 1 {
            return Err("请使用新版 hearthread 打开此书库".into());
        }
        db.execute_batch("PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;
          CREATE TABLE IF NOT EXISTS records(key TEXT PRIMARY KEY,value TEXT NOT NULL,version INTEGER NOT NULL);
          PRAGMA user_version=1;").map_err(err)?;
        Ok(Self {
            root: root.into(),
            db: Mutex::new(db),
            uploads: Mutex::default(),
            next_upload: AtomicU32::default(),
        })
    }
    pub fn records(&self) -> Result<Vec<Record>> {
        let db = self.db.lock().map_err(err)?;
        let mut stmt = db
            .prepare("SELECT key,value,version FROM records ORDER BY key")
            .map_err(err)?;
        stmt.query_map([], |r| {
            Ok(Record {
                key: r.get(0)?,
                value: r.get(1)?,
                version: r.get(2)?,
            })
        })
        .map_err(err)?
        .collect::<rusqlite::Result<_>>()
        .map_err(err)
    }
    pub fn commit(&self, changes: Vec<Change>) -> Result<()> {
        let mut db = self.db.lock().map_err(err)?;
        let tx = db.transaction().map_err(err)?;
        for change in changes {
            let updated = if change.expected == 0 {
                tx.execute(
                    "INSERT INTO records VALUES(?1,?2,1) ON CONFLICT DO NOTHING",
                    params![change.key, change.value],
                )
            } else {
                tx.execute(
                    "UPDATE records SET value=?2,version=version+1 WHERE key=?1 AND version=?3",
                    params![change.key, change.value, change.expected],
                )
            }
            .map_err(err)?;
            if updated == 0 {
                return Err("书库已更新，请重新载入后再试".into());
            }
        }
        tx.commit().map_err(err)
    }
    pub fn begin(&self, expected: u64) -> Result<u32> {
        let id = self.next_upload.fetch_add(1, Ordering::Relaxed);
        let file = NamedTempFile::new_in(self.root.join("objects")).map_err(err)?;
        self.uploads.lock().map_err(err)?.insert(
            id,
            Upload {
                file,
                hash: Sha256::new(),
                written: 0,
                expected,
            },
        );
        Ok(id)
    }
    pub fn append(&self, id: u32, offset: u64, bytes: &[u8]) -> Result<()> {
        let mut uploads = self.uploads.lock().map_err(err)?;
        let stage = uploads.get_mut(&id).ok_or("导入会话已结束")?;
        if offset != stage.written || bytes.len() as u64 > stage.expected - stage.written {
            return Err("文件分块位置错误".into());
        }
        stage.file.write_all(bytes).map_err(err)?;
        stage.hash.update(bytes);
        stage.written += bytes.len() as u64;
        Ok(())
    }
    pub fn cancel(&self, id: u32) -> Result<()> {
        self.uploads.lock().map_err(err)?.remove(&id);
        Ok(())
    }
    pub fn finish(&self, id: u32) -> Result<String> {
        let stage = self
            .uploads
            .lock()
            .map_err(err)?
            .remove(&id)
            .ok_or("导入会话已结束")?;
        if stage.written != stage.expected {
            return Err("文件尚未完整写入".into());
        }
        let digest: String = stage
            .hash
            .finalize()
            .iter()
            .map(|byte| format!("{byte:02x}"))
            .collect();
        let path = self.root.join("objects").join(&digest);
        if !path.exists() {
            stage.file.as_file().sync_all().map_err(err)?;
            match stage.file.persist_noclobber(path) {
                Ok(_) => (),
                Err(e) if e.error.kind() == std::io::ErrorKind::AlreadyExists => (),
                Err(e) => return Err(err(e)),
            }
        }
        Ok(digest)
    }
    pub fn object(&self, digest: &str) -> Result<PathBuf> {
        if digest.len() != 64 || !digest.bytes().all(|b| b.is_ascii_hexdigit()) {
            return Err("无效文件标识".into());
        }
        let path = self.root.join("objects").join(digest);
        if !path.is_file() {
            return Err("找不到书籍原文件".into());
        }
        Ok(path)
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn restart_dedup_and_conflict_rollback() {
        let dir = tempfile::tempdir().unwrap();
        let store = Library::open(dir.path()).unwrap();
        let save = || {
            let id = store.begin(8).unwrap();
            store.append(id, 0, b"# A ").unwrap();
            assert!(store.append(id, 0, b"x").is_err());
            store.append(id, 4, b"book").unwrap();
            store.finish(id).unwrap()
        };
        let key = save();
        assert_eq!(key, save());
        let partial = store.begin(12).unwrap();
        assert!(store.finish(partial).is_err());
        assert!(store.object("../catalog.sqlite3").is_err());
        let change = |key: &str, expected| Change {
            key: key.into(),
            value: "title".into(),
            expected,
        };
        store.commit(vec![change("book", 0)]).unwrap();
        assert!(
            store
                .commit(vec![change("other", 0), change("book", 0)])
                .is_err()
        );
        drop(store);
        let reopened = Library::open(dir.path()).unwrap();
        assert_eq!(reopened.records().unwrap().len(), 1);
        assert_eq!(
            fs::read(reopened.object(&key).unwrap()).unwrap(),
            b"# A book"
        );
    }
}
