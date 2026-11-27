// Count physical columns in reading order. The live paginator keeps only nearby
// sections mounted. A direct jump may need earlier, unvisited columns counted.
const layouts = new WeakMap()

async function measure(pager, section, styles, prepare) {
    const holder = document.createElement('div')
    holder.inert = true
    holder.style.cssText = 'position:fixed;inset:0 auto auto 0;visibility:hidden;pointer-events:none;overflow:hidden'
    const box = pager.getBoundingClientRect()
    holder.style.width = box.width + 'px'
    holder.style.height = box.height + 'px'
    const root = holder.attachShadow({ mode: 'closed' })
    const copy = document.createElement('foliate-paginator')
    const css = document.createElement('style')
    css.textContent = 'foliate-paginator{display:block;width:100%;height:100%}foliate-paginator::part(container){width:round(down,100%,2px);height:round(down,100%,2px);place-self:center}'
    for (const name of ['max-inline-size', 'max-column-count', 'margin-left', 'margin-right'])
        if (pager.hasAttribute(name)) copy.setAttribute(name, pager.getAttribute(name))
    copy.setAttribute('no-preload', '')
    if (prepare) copy.addEventListener('load', e => prepare(e.detail.doc))
    root.append(css, copy)
    document.body.append(holder)
    try {
        // The live paginator already split large spine items into layout units.
        copy.open({ dir: pager.bookDir, sections: [{ ...section, size: 0 }] })
        copy.setStyles(styles)
        await copy.goTo({ index: 0 })
        const content = copy.getContents()[0]
        if (!content?.doc?.body || section.linear === 'no') return 0
        await content.doc.fonts.ready
        return copy.getContents()[0]?.contentPages ?? 0
    } finally {
        copy.destroy()
        holder.remove()
    }
}

export async function pageRange(pager, views, start, columnWidth, styles, fontKey, prepare) {
    if (!columnWidth) return
    const key = JSON.stringify([pager.clientWidth, pager.clientHeight,
        pager.getAttribute('max-column-count'), pager.getAttribute('max-inline-size'), styles, fontKey])
    let layout = layouts.get(pager)
    if (layout?.key !== key) {
        layout = { key, counts: new Map(), pending: new Map(), revision: 0 }
        layouts.set(pager, layout)
    }
    const revision = ++layout.revision
    const left = Math.round(start / columnWidth)
    const end = left + pager.columnCount
    let offset = 0, firstUnit, firstLocal, visible = 0
    for (const [unit, view] of views) {
        const count = view.contentPages
        if (!view.rendered) continue
        layout.counts.set(unit, count)
        const from = Math.max(left - offset, 0)
        const to = Math.min(end - offset, count)
        if (to > from) {
            if (firstUnit == null) { firstUnit = unit; firstLocal = from }
            visible += to - from
        }
        offset += count
    }
    if (firstUnit == null) return
    let first = firstLocal + 1
    for (let unit = 0; unit < firstUnit; unit++) {
        const section = pager.sections[unit]
        if (section.linear === 'no') continue
        if (!layout.counts.has(unit)) {
            let job = layout.pending.get(unit)
            if (!job) {
                job = measure(pager, section, styles, prepare)
                    .finally(() => layout.pending.delete(unit))
                layout.pending.set(unit, job)
            }
            const count = await job
            if (!pager.isConnected || revision !== layout.revision || layouts.get(pager) !== layout) return
            if (!layout.counts.has(unit)) layout.counts.set(unit, count)
        }
        first += layout.counts.get(unit)
    }
    return visible > 1 ? [first, first + visible - 1] : [first]
}
