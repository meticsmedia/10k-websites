/* forms.js: sends every <form data-k-form="name"> to the site's own backend (api/submit.php).
   Shows the form's [data-k-sent] block on success and [data-k-error] on failure.
   In a local preview without PHP, the form explains that it starts working once the site is online. */
(() => {
  const forms = document.querySelectorAll('form[data-k-form]');
  if (!forms.length) return;
  const endpoint = (document.querySelector('meta[name="k-endpoint"]') || {}).content || 'api/submit.php';
  let stamp = null, live = null;
  const ready = fetch(endpoint + '?stamp=1', { headers: { Accept: 'application/json' }, cache: 'no-store' })
    .then(r => (r.ok ? r.json() : Promise.reject())).then(j => { stamp = j.stamp; live = true; })
    .catch(() => { live = false; });
  const hidden = (form, name, value) => {
    let i = form.querySelector(`input[name="${name}"]`);
    if (!i) { i = document.createElement('input'); i.type = 'hidden'; i.name = name; form.appendChild(i); }
    i.value = value;
  };
  forms.forEach(form => {
    form.action = form.getAttribute('action') || endpoint;
    form.method = 'post';
    // a field only bots can see and fill
    const trap = document.createElement('div');
    trap.setAttribute('aria-hidden', 'true');
    trap.style.cssText = 'position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden';
    trap.innerHTML = '<label>Website<input name="_website" tabindex="-1" autocomplete="off"></label>';
    form.appendChild(trap);
    hidden(form, '_form', form.dataset.kForm || 'contact');
    hidden(form, '_page', location.pathname);
    const sent = form.querySelector('[data-k-sent]'), err = form.querySelector('[data-k-error]');
    [sent, err].forEach(e => e && (e.hidden = true));
    const setState = s => { form.dataset.kState = s; if (sent) sent.hidden = s !== 'sent'; if (err) err.hidden = s !== 'error' && s !== 'preview'; };
    form.addEventListener('submit', async e => {
      e.preventDefault();
      if (!form.reportValidity()) return;
      await ready;
      if (!live) { setState('preview'); if (err) err.textContent = 'This form starts working once the site is online.'; return; }
      hidden(form, '_t', stamp);
      const btn = form.querySelector('[type="submit"],button:not([type])');
      if (btn) btn.disabled = true;
      setState('sending');
      try {
        const res = await fetch(form.action, { method: 'POST', body: new FormData(form), headers: { Accept: 'application/json' } });
        const j = await res.json().catch(() => ({}));
        if (!res.ok || !j.ok) throw new Error(j.error || 'failed');
        form.reset(); setState('sent');
        (sent || form).focus?.();
      } catch (x) {
        setState('error');
      } finally { if (btn) btn.disabled = false; }
    });
  });
})();
