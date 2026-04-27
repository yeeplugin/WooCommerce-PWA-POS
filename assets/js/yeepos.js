(function () {
    // Listen for Trigger Payment from Parent (React POS)
    window.addEventListener('message', function (event) {
        if (event.data && event.data.type === 'yeepos_trigger_payment') {
            var form = document.querySelector('form.checkout, form#order_review');
            if (form) {
                var placeOrderBtn = document.querySelector('#place_order');
                if (placeOrderBtn) placeOrderBtn.click();
                else form.submit();
            }
        }
    });
    document.addEventListener('DOMContentLoaded', function () {
        const errorItems = document.querySelectorAll('.woocommerce-error li');
        const errorList = document.querySelector('.woocommerce-error');

        if (!errorList) return;

        errorItems.forEach(li => {
            if (li.textContent.includes('paying for a guest order')) {
                li.style.display = 'none';
            }
        });
        const visibleItems = Array.from(errorItems).filter(li => li.style.display !== 'none');
        if (visibleItems.length === 0) {
            errorList.style.display = 'none';
        }
    });
    // Detect Success and notify Parent
    var notified = false;

    var notifyParent = function () {
        if (notified) return;
        notified = true;
        console.log('[YeePOS] Payment success detected — notifying POS app');
        window.parent.postMessage({ type: 'yeepos_payment_success' }, '*');
    };

    var checkSuccess = function () {
        if (notified) return;
        var isSuccess = document.body.classList.contains('woocommerce-order-received') ||
            !!document.querySelector('.woocommerce-thankyou-order-received') ||
            !!document.querySelector('.woocommerce-notice--success');

        if (isSuccess) {
            notifyParent();
        }
    };

    // Strategy 1: Check immediately (body may already have the class)
    checkSuccess();

    // Strategy 2: Check after DOM is fully ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', checkSuccess);
    }

    // Strategy 3: MutationObserver for SPA-style redirects
    var observer = new MutationObserver(function () {
        checkSuccess();
        if (notified) observer.disconnect();
    });

    observer.observe(document.body, {
        attributes: true,
        childList: true,
        subtree: true
    });

    // Strategy 4: Fallback polling (in case observer misses it)
    var pollCount = 0;
    var poller = setInterval(function () {
        checkSuccess();
        pollCount++;
        if (notified || pollCount > 30) { // Stop after ~15 seconds
            clearInterval(poller);
        }
    }, 500);
})();