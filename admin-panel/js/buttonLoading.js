export const startButtonLoading = (button, loadingLabel = "Processing...") => {
  if (!(button instanceof HTMLButtonElement)) {
    return () => {};
  }

  if (!button.dataset.originalHtml) {
    button.dataset.originalHtml = button.innerHTML;
  }

  const labelText = String(loadingLabel || "").trim() || "Processing...";
  button.disabled = true;
  button.classList.add("is-loading");
  button.innerHTML = `
    <span class="btn-loading">
      <span class="btn-spinner" aria-hidden="true"></span>
      <span>${labelText}</span>
    </span>
  `;

  return () => {
    button.classList.remove("is-loading");
    if (button.dataset.originalHtml) {
      button.innerHTML = button.dataset.originalHtml;
      delete button.dataset.originalHtml;
    }
    button.disabled = false;
  };
};

