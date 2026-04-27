jQuery(document).ready(function($) {
    // App Icon Selection
    $('#yeepos_pwa_icon_button').on('click', function(e) {
        e.preventDefault();
        var image = wp.media({
            title: 'Select App Icon',
            multiple: false
        }).open()
        .on('select', function(e) {
            var uploaded_image = image.state().get('selection').first();
            var image_url = uploaded_image.toJSON().url;
            $('#yeepos_pwa_icon_input').val(image_url);
            $('#yeepos_pwa_icon_preview').attr('src', image_url);
        });
    });

    // Initialize WooCommerce Enhanced Select (Select2)
    if ( typeof $.fn.select2 !== 'undefined' ) {
        $( '.wc-enhanced-select' ).select2();
    }
});
