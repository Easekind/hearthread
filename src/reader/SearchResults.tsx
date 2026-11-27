import { t } from "../i18n";
import type { SearchHit } from "./engine";
import { searchLimit } from "./search";

export function SearchResults({
  hits,
  choose,
}: {
  hits: SearchHit[];
  choose(hit: SearchHit): void;
}) {
  const groups = new Map<string, SearchHit[]>();
  for (const hit of hits) {
    const group = groups.get(hit.groupId);
    if (group) group.push(hit);
    else groups.set(hit.groupId, [hit]);
  }
  return (
    <>
      {Array.from(groups, ([id, group]) => (
        <details key={id} className="search-group" open>
          <summary>
            <span>{group[0].group}</span>
            <small>{group.length}</small>
          </summary>
          <div>
            {group.map((hit, i) => (
              <button
                key={i}
                className="search-hit"
                onClick={() => choose(hit)}
              >
                {hit.excerpt.pre}
                <mark>{hit.excerpt.match}</mark>
                {hit.excerpt.post}
              </button>
            ))}
          </div>
        </details>
      ))}
      {hits.length === searchLimit && (
        <p>{t("reader.searchLimit", { count: searchLimit })}</p>
      )}
    </>
  );
}
