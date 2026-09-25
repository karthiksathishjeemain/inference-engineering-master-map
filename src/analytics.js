// Same-origin Vercel Web Analytics; skip on local development and the Pages mirror.
if (location.hostname.endsWith('.vercel.app')) {
  window.va = window.va || function () { (window.vaq = window.vaq || []).push(arguments); };
  const script = document.createElement('script');
  script.defer = true;
  script.src = '/_vercel/insights/script.js';
  document.head.appendChild(script);
}
