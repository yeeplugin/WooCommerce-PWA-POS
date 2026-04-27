export const toast = {
  success: (message) => showToast(message, 'success'),
  error: (message) => showToast(message, 'error'),
};

function showToast(message, type) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'fixed top-0 left-0 right-0 md:top-10 md:left-1/2 md:-translate-x-1/2 z-[11000] flex flex-col gap-2 pointer-events-none items-center p-4 md:p-0 md:w-full md:max-w-xs';
    document.body.appendChild(container);
  }

  const toastEl = document.createElement('div');
  toastEl.className = `w-full md:w-auto px-6 py-4 md:px-5 md:py-3 rounded-xl md:rounded-lg shadow-2xl font-bold text-[11px] md:text-xs uppercase tracking-wider transform transition-all duration-300 -translate-y-4 opacity-0 flex items-center gap-3 ${type === 'success' ? 'bg-[#0ea5e9] text-white border border-[#0ea5e9]/50' : 'bg-red-500 text-white border border-red-500/50'
    }`;

  const icon = document.createElement('span');
  icon.className = 'material-icons-outlined text-lg';
  icon.innerText = type === 'success' ? 'check_circle' : 'error_outline';

  const text = document.createElement('span');
  text.innerText = message;

  toastEl.appendChild(icon);
  toastEl.appendChild(text);
  container.appendChild(toastEl);

  // Animate in
  requestAnimationFrame(() => {
    toastEl.classList.remove('-translate-y-4', 'opacity-0');
  });

  // Remove after 3 seconds
  setTimeout(() => {
    toastEl.classList.add('-translate-y-4', 'opacity-0');
    setTimeout(() => {
      toastEl.remove();
      if (container.childNodes.length === 0) {
        container.remove();
      }
    }, 300);
  }, 3000);
}

export default toast;
