import { useEffect } from 'react';
import { headTags, type PageMeta } from './meta';

/*
 * Keeps <head> in sync on client-side navigation. The prerendered HTML already has the right
 * tags for the first page; this swaps them (everything marked data-seo) whenever the page changes.
 */

function apply(meta: PageMeta) {
  document.title = meta.title;
  document.head.querySelectorAll('[data-seo]').forEach((el) => el.remove());
  const frag = document.createDocumentFragment();
  for (const t of headTags(meta)) {
    const el = document.createElement(t.tag);
    el.setAttribute('data-seo', '');
    for (const [k, v] of Object.entries(t.attrs)) el.setAttribute(k, v);
    if (t.text) el.textContent = t.text;
    frag.appendChild(el);
  }
  document.head.appendChild(frag);
}

/** Pass null while the page's data is still loading to leave the current tags alone. */
export function useSeo(meta: PageMeta | null) {
  const key = meta ? JSON.stringify(meta) : '';
  useEffect(() => {
    if (meta) apply(meta);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}
