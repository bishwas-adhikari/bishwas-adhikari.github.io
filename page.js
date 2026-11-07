(() => {
    const view = document.getElementById('view'), P = new URLSearchParams(location.search);
    document.getElementById('y').textContent = new Date().getFullYear();
    const el = (t, a = {}, ...k) => { const e = document.createElement(t); for (const [n, v] of Object.entries(a)) n === 'class' ? e.className = v : e.setAttribute(n, v); k.forEach(c => e.append(c)); return e; };
    const NAMES = { update: 'Updates', article: 'Blog / Articles', news: 'Latest News', opportunity: 'Opportunities', video: 'Videos', resource: 'Additional Resources' };
    const ytId = u => (u.match(/(?:youtu\.be\/|v=|embed\/)([\w-]{11})/) || [])[1];
    const grid = list => el('div', { class: 'latest-grid' }, ...(list.length ? list.map(i => {
      const a = el('a', { class: 'item-card', href: 'page.html?id=' + i.id });
      a.append(el('div', { class: 'item-thumb' }, i.type === 'video' ? '▶' : ''), el('div', { class: 'item-body' }, el('span', { class: 'item-date' }, i.date), el('h3', {}, i.title), ...(i.summary ? [el('p', {}, i.summary)] : [])));
      return a;
    }) : [el('p', { class: 'empty' }, 'Nothing here yet.')]));

    function detail(id) {
      window.FSNFirebase.watchItem(id, i => {
        view.replaceChildren();
        if (!i) {
          view.append(el('h2', {}, 'Not found'), el('a', { class: 'text-link', href: 'index.html' }, '← Back to home'));
          return;
        }
        document.title = i.title + ' – Forest Service Nepal';
        view.append(el('a', { class: 'text-link', href: 'page.html?type=' + i.type }, '← ' + NAMES[i.type]), el('span', { class: 'eyebrow', style: 'margin-top:18px' }, i.date), el('h2', {}, i.title));
        if (i.summary) view.append(el('p', {}, i.summary));
        const y = ytId(i.url || ''); if (i.type === 'video' && y) view.append(el('iframe', { src: 'https://www.youtube-nocookie.com/embed/' + y, style: 'width:100%;max-width:760px;aspect-ratio:16/9;border:0;margin-top:16px', allowfullscreen: '', title: i.title }));
        if (i.body) view.append(el('div', { class: 'article-body' }, i.body));
        if (i.url && !(i.type === 'video' && y)) view.append(el('p', { style: 'margin-top:20px' }, el('a', { class: 'btn', href: i.url, target: '_blank', rel: 'noopener' }, i.type === 'resource' ? 'Download / open file' : 'Open link')));
        if (!i.body && !i.url && !i.summary) view.append(el('p', { class: 'article-body' }, 'No further details have been added yet.'));
      }, error => view.append(el('p', { class: 'empty' }, error.message || 'Unable to load this item.')));
    }

    function list(type, q) {
      view.replaceChildren();
      window.FSNFirebase.watchItems(items => {
        let filtered = items;
        if (type) filtered = filtered.filter(item => item.type === type);
        const search = String(q || '').trim().toLowerCase();
        if (search) filtered = filtered.filter(item => [item.title, item.title_ne, item.summary, item.body].join(' ').toLowerCase().includes(search));
        view.replaceChildren(el('h2', {}, search ? 'Search: ' + search : NAMES[type] || 'All content'), grid(filtered.slice(0, 200)));
        if (type === 'article' || type === 'news') view.append(el('p', { style: 'margin-top:24px' }, el('a', { class: 'submit-link', href: 'page.html?submit=' + type }, 'Submit ' + (type === 'news' ? 'News' : 'Article/Blog') + ' →')));
      }, error => view.append(el('p', { class: 'empty' }, error.message || 'Unable to load content.')));
    }

    function submit(type) {
      type = type === 'news' ? 'news' : 'article';
      const f = el('form', { class: 'form' });
      const field = (label, name, tag = 'input', attrs = {}) => el('label', {}, label, el(tag, { name, ...attrs }));
      f.append(field('Your name', 'name', 'input', { required: '', maxlength: 100 }), field('Email (optional)', 'email', 'input', { type: 'email', maxlength: 120 }),
        field('Title', 'title', 'input', { required: '', maxlength: 200 }), field('Content', 'body', 'textarea', { required: '', rows: 10 }),
        field('Source link (optional)', 'link', 'input', { type: 'url', maxlength: 500 }),
        el('input', { class: 'hp', name: 'website', tabindex: '-1', autocomplete: 'off', 'aria-hidden': 'true' }),
        el('button', { class: 'btn', type: 'submit' }, 'Send for review'));
      const msg = el('p', { class: 'msg', hidden: '' });
      f.addEventListener('submit', async e => {
        e.preventDefault(); msg.hidden = true;
        try {
          await window.FSNFirebase.submit({ ...Object.fromEntries(new FormData(f)), type });
          msg.className = 'msg'; msg.textContent = 'Thank you. Your submission was sent and will appear once an admin approves it.'; msg.hidden = false;
          f.reset();
        } catch (error) {
          msg.className = 'msg err'; msg.textContent = error.message || 'Something went wrong.'; msg.hidden = false;
        }
      });
      view.append(el('h2', {}, type === 'news' ? 'Submit News' : 'Submit Article / Blog'), el('p', {}, 'Send your news or article draft to the website administrators. It will not appear publicly unless an admin reviews and approves it.'), f, msg);
    }

    if (P.get('id')) detail(P.get('id')); else if (P.get('submit')) submit(P.get('submit')); else list(P.get('type'), P.get('q'));
})();
