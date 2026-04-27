<?php
if (! defined('ABSPATH')) {
    exit; // Exit if accessed directly
}
class Yeekit_Woo_Pos_Frontend
{
    public function __construct()
    {
        add_action('template_redirect', [$this, 'render_pos_app']);
        add_action('init', [$this, 'handle_sw_request'], 1);
        add_action('init', [$this, 'handle_manifest_request'], 1);
        add_action('show_admin_bar', [$this, 'disable_admin_bar']);
        add_action('wp_enqueue_scripts', [$this, 'enqueue_pos_checkout_assets']);
        add_action('send_headers', [$this, 'add_frame_ancestors_header']);
    }
    public function enqueue_pos_checkout_assets()
    {
        if ($this->is_pos_checkout_context()) {
            wp_enqueue_style('yeepos-checkout', YEEKIT_WOO_POS_URL . 'assets/css/yeepos.css', [], time());
            wp_enqueue_script('yeepos-checkout', YEEKIT_WOO_POS_URL . 'assets/js/yeepos.js', [], time(), true);
        }
    }
    public function add_frame_ancestors_header()
    {
        if ($this->is_pos_checkout_context()) {
            header_remove('X-Frame-Options');
            header('Content-Security-Policy: frame-ancestors *');
        }
    }
    public function disable_admin_bar($show)
    {
        if ($this->is_pos_checkout_context()) {
            return false;
        }
        return $show;
    }
    private function is_pos_checkout_context()
    {
        if (isset($_GET['pos_pay'])) { //phpcs:ignore WordPress.Security.NonceVerification.Recommended
            return true;
        }
        if (function_exists('is_order_received_page') && is_order_received_page()) {
            global $wp;
            $order_id = isset($wp->query_vars['order-received']) ? absint($wp->query_vars['order-received']) : 0;
            if ($order_id) {
                $order = wc_get_order($order_id);
                return $order && $order->get_meta('_yeepos_pos_order') === 'yes';
            }
        }
        return false;
    }
    public function render_pos_app()
    {
        if (get_query_var('yeepos_app')) {
            $is_logged_in = is_user_logged_in();
            $can_access = current_user_can('manage_woocommerce') || current_user_can('access_yeepos');
            $current_user = wp_get_current_user();
            $yee_pos_data = [
                'apiUrl'  => esc_url_raw(rest_url()),
                'nonce'   => wp_create_nonce('wp_rest'),
                'siteUrl' => site_url(),
                'siteTitle' => get_bloginfo('name'),
                'isLoggedIn' => $is_logged_in && $can_access,
                'loginUrl'   => wp_login_url(),
                'logoutUrl'  => wp_logout_url(site_url('/pos')),
                'pwa' => [
                    'theme_color' => get_option('yeepos_pwa_theme_color', '#0ea5e9'),
                    'short_name'  => get_option('yeepos_pwa_short_name', 'YeePOS'),
                ],
                'currentUser' => ($is_logged_in && $can_access) ? [
                    'id'           => $current_user->ID,
                    'display_name' => $current_user->display_name,
                    'user_email'   => $current_user->user_email,
                    'avatar'       => get_avatar_url($current_user->ID),
                    'roles'        => $current_user->roles,
                ] : null,
                'activeModules' => apply_filters('yeepos_active_modules', [
                    'food' => false
                ]),
                'locale' => substr(get_locale(), 0, 2)
            ];
?>
            <!DOCTYPE html>
            <html <?php language_attributes(); ?> style="--brand-primary: <?php echo esc_attr($yee_pos_data['pwa']['theme_color']); ?>;">

            <head>
                <meta charset="<?php bloginfo('charset'); ?>">
                <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
                <title><?php echo esc_attr($yee_pos_data['pwa']['short_name']); ?></title>
                <!-- PWA Manifest & App Setup -->
                <link rel="manifest" href="<?php echo esc_url(site_url('yeepos-manifest.json')); ?>">
                <meta name="theme-color" content="#050505" media="(prefers-color-scheme: dark)">
                <meta name="theme-color" content="#f9fafb" media="(prefers-color-scheme: light)">
                <meta name="apple-mobile-web-app-capable" content="yes">
                <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
                <meta name="apple-mobile-web-app-title" content="<?php echo esc_attr($yee_pos_data['pwa']['short_name']); ?>">
                <link rel="apple-touch-icon" href="<?php echo esc_url(get_option('yeepos_pwa_icon', YEEKIT_WOO_POS_URL . 'assets/icon-512.png')); ?>">
                <script>
                    window.yeePOSData = <?php echo wp_json_encode($yee_pos_data); ?>;
                </script>
                <?php
                $is_dev = false;
                if ($is_dev) :
                /*
                ?>
                    <script type="module">
                        import RefreshRuntime from "http://localhost:5173/@react-refresh"
                        RefreshRuntime.injectIntoGlobalHook(window)
                        window.$RefreshReg$ = () => {}
                        window.$RefreshSig$ = () => (type) => type
                        window.__vite_plugin_react_preamble_installed__ = true
                    </script>
                    <script type="module" src="http://localhost:5173/@vite/client"></script>
                    <script type="module" src="http://localhost:5173/src/main.jsx"></script>
                <?php
                */
                else :
                    // Fixed filenames from Vite config (no hashing)
                    $js_file  = 'app/dist/assets/main.js';
                    $css_file = 'app/dist/assets/main.css';
                ?>
                    <link rel="stylesheet" href="<?php echo esc_url(YEEKIT_WOO_POS_URL . $css_file); //phpcs:ignore WordPress.WP.EnqueuedResources.NonEnqueuedStylesheet 
                                                    ?>">
                    <script type="module" src="<?php echo esc_url(YEEKIT_WOO_POS_URL . $js_file); //phpcs:ignore WordPress.WP.EnqueuedResources.NonEnqueuedScript 
                                                ?>"></script>
                <?php endif; ?>
                <style>
                    body,
                    html {
                        margin: 0;
                        padding: 0;
                        width: 100%;
                        height: 100%;
                        overflow: hidden;
                        background: #0A0A0E;
                    }

                    @media (prefers-color-scheme: light) {
                        body, html {
                            background: #f9fafb;
                        }
                    }

                    #root {
                        height: 100vh;
                        width: 100vw;
                    }
                </style>
            </head>

            <body>
                <div id="root"></div>
            </body>

            </html>
<?php
            exit;
        }
    }
    public function handle_sw_request()
    {
        if (strpos($_SERVER['REQUEST_URI'], 'yeepos-sw.js') !== false || isset($_GET['yeepos_sw'])) { //phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotValidated, WordPress.Security.ValidatedSanitizedInput.MissingUnslash, WordPress.Security.ValidatedSanitizedInput.InputNotSanitized, WordPress.Security.NonceVerification.Recommended
            header('Content-Type: application/javascript');
            header('Service-Worker-Allowed: /');
            $sw_path = YEEKIT_WOO_POS_PATH . 'app/dist/sw.js';
            if (file_exists($sw_path)) {
                echo file_get_contents($sw_path); //phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
            } else {
                echo file_get_contents(YEEKIT_WOO_POS_PATH . 'sw.js'); //phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
            }
            exit;
        }
    }
    public function handle_manifest_request()
    {
        if (strpos($_SERVER['REQUEST_URI'], 'yeepos-manifest.json') !== false || isset($_GET['yeepos_manifest'])) { //phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotValidated, WordPress.Security.ValidatedSanitizedInput.MissingUnslash, WordPress.Security.ValidatedSanitizedInput.InputNotSanitized, WordPress.Security.NonceVerification.Recommended
            header('Content-Type: application/json');
            $pwa_name = get_option('yeepos_pwa_name', get_bloginfo('name'));
            $pwa_short = get_option('yeepos_pwa_short_name', 'YeePOS');
            $pwa_theme = get_option('yeepos_pwa_theme_color', '#0ea5e9');
            $pwa_bg = get_option('yeepos_pwa_bg_color', '#ffffff');
            $pwa_icon = esc_url(get_option('yeepos_pwa_icon', YEEKIT_WOO_POS_URL . 'assets/icon-512.png'));
            echo json_encode([
                "name" => $pwa_name,
                "short_name" => $pwa_short,
                "start_url" => site_url('/pos'),
                "display" => "standalone",
                "background_color" => $pwa_bg,
                "theme_color" => $pwa_theme,
                "icons" => [
                    [
                        "src" => $pwa_icon,
                        "sizes" => "512x512",
                        "type" => "image/png"
                    ]
                ]
            ]);
            exit;
        }
    }
}
new Yeekit_Woo_Pos_Frontend();
