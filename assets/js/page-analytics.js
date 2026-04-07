(() => {
  const VISITOR_KEY = 'vitrine_visitor_id';

  function getVisitorId() {
    const existing = window.localStorage.getItem(VISITOR_KEY);
    if (existing) return existing;

    const generated = `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
    window.localStorage.setItem(VISITOR_KEY, generated);
    return generated;
  }

  function getUtmParams(search = window.location.search) {
    const params = new URLSearchParams(search || '');
    return {
      utm_source: params.get('utm_source') || null,
      utm_medium: params.get('utm_medium') || null,
      utm_campaign: params.get('utm_campaign') || null
    };
  }

  async function trackEvent({
    storeProfileId,
    pageSlug,
    eventName,
    eventSource = null,
    blockType = null,
    productId = null,
    payload = {}
  } = {}) {
    if (!window.db || !storeProfileId || !eventName) {
      return false;
    }

    const utm = getUtmParams();

    try {
      const { error } = await window.db.rpc('track_store_page_event', {
        store_profile_id: storeProfileId,
        page_slug: pageSlug || null,
        event_name: eventName,
        event_source: eventSource,
        block_type: blockType,
        product_id: productId || null,
        visitor_id: getVisitorId(),
        referrer_url: document.referrer || null,
        utm_source: utm.utm_source,
        utm_medium: utm.utm_medium,
        utm_campaign: utm.utm_campaign,
        payload: payload || {}
      });

      if (error) {
        console.warn('Falha ao registrar analytics:', error.message);
        return false;
      }

      return true;
    } catch (error) {
      console.warn('Falha ao registrar analytics:', error.message);
      return false;
    }
  }

  window.PageAnalytics = {
    getVisitorId,
    getUtmParams,
    trackEvent
  };
})();
