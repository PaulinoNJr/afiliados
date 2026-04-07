(() => {
  function initStoreCustomizationSteps() {
    const flow = document.querySelector('.personalization-flow');
    const stepButtons = Array.from(document.querySelectorAll('[data-step-target]'));
    const panels = Array.from(document.querySelectorAll('[data-step-panel]'));

    if (!flow || !stepButtons.length || !panels.length) return;

    const totalSteps = panels.length;
    let currentStep = Number(flow.dataset.currentStep || 1);

    function getPanel(step) {
      return panels.find((panel) => Number(panel.dataset.stepPanel) === Number(step));
    }

    function activateStep(step, shouldScroll = true) {
      const normalizedStep = Math.min(Math.max(Number(step) || 1, 1), totalSteps);
      currentStep = normalizedStep;
      flow.dataset.currentStep = String(normalizedStep);

      stepButtons.forEach((button) => {
        const isActive = Number(button.dataset.stepTarget) === normalizedStep;
        button.classList.toggle('is-active', isActive);
        button.setAttribute('aria-selected', String(isActive));
      });

      panels.forEach((panel) => {
        const isActive = Number(panel.dataset.stepPanel) === normalizedStep;
        panel.classList.toggle('is-active', isActive);
        panel.hidden = !isActive;
      });

      if (shouldScroll) {
        flow.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }

    stepButtons.forEach((button) => {
      button.addEventListener('click', () => activateStep(button.dataset.stepTarget));
    });

    panels.forEach((panel) => {
      panel.querySelectorAll('[data-step-action]').forEach((button) => {
        button.addEventListener('click', () => {
          const action = button.dataset.stepAction;
          if (action === 'next') {
            activateStep(currentStep + 1);
            return;
          }
          if (action === 'prev') {
            activateStep(currentStep - 1);
          }
        });
      });
    });

    const hashStep = Number(window.location.hash.replace('#etapa-', ''));
    activateStep(Number.isFinite(hashStep) && hashStep > 0 ? hashStep : currentStep, false);
  }

  document.addEventListener('DOMContentLoaded', initStoreCustomizationSteps);
})();
