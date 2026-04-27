<?php
if (! defined('ABSPATH')) {
    exit; // Exit if accessed directly
}
class Yeekit_Woo_Pos_Backend
{
    public function __construct()
    {
        add_action('admin_menu', [$this, 'register_admin_menu']);
        add_action('admin_enqueue_scripts', [$this, 'enqueue_admin_assets']);
        // Order Admin Hooks: Display Cashier info
        add_action('woocommerce_admin_order_data_after_billing_address', [$this, 'display_cashier_in_order_admin'], 10, 1);
        add_action('init', [$this, 'register_yeepos_roles']);
        add_action('init', [$this, 'add_rewrite_rules']);
    }
    public function enqueue_admin_assets($hook)
    {
        if ('toplevel_page_yeepos' !== $hook) {
            return;
        }
        wp_enqueue_media();

        // Enqueue WooCommerce styles and scripts for product search
        wp_enqueue_style('woocommerce_admin_styles', WC()->plugin_url() . '/assets/css/admin.css', [], WC_VERSION);
        wp_enqueue_script('wc-enhanced-select');
        wp_enqueue_script('select2');

        wp_enqueue_style('yeepos-admin-css', YEEKIT_WOO_POS_URL . 'assets/css/admin.css', [], YEEKIT_WOO_POS_VERSION);
        wp_enqueue_script('yeepos-admin-js', YEEKIT_WOO_POS_URL . 'assets/js/admin.js', ['jquery', 'wc-enhanced-select'], YEEKIT_WOO_POS_VERSION, true);
    }
    public function register_yeepos_roles()
    {
        // if (get_role('yeepos_cashier')) {
        //     return;
        // }
        remove_role('yeepos_cashier');
        $caps = [
            "read" => true,
            "level_0" => true,
            "view_admin_dashboard" => true,
            "access_yeepos" => true, // Capability to filter and prevent redirect
            // --- PRODUCT: Required for API v3 to fetch product list ---
            "edit_products"             => true,  // Open API access
            "edit_published_products"   => true,  // IMPORTANT: Allow editing products currently in stock
            "edit_others_products"      => true,  // Required if cashier edits products created by Admin
            "read_product"              => true,
            "read_private_products"     => true,
            "manage_product_terms"      => true,  // To be able to edit product categories/tags
            "assign_product_terms"      => true,
            // If you want them to be able to unpublish or save drafts, add this:
            "publish_products"          => true,
            // --- PRODUCT CATEGORIES (TAXONOMIES) ---
            "edit_product_terms"   => true, // Necessary for API v3 to allow data reading
            // --- ORDERS: Cashier must be able to create and edit orders ---
            "edit_shop_order"              => true,
            "read_shop_order"              => true,
            "edit_shop_orders"             => true,
            "read_private_shop_orders"     => true, // IMPORTANT: API v3 needs this to list orders
            "edit_others_shop_orders"      => true, // To view/edit orders from other shifts
            "publish_shop_orders"          => true,
            "edit_published_shop_orders"   => true,
            "manage_shop_order_terms"      => true, // Related to order status/tags
            "assign_shop_order_terms"      => true,
            // --- CUSTOMERS: To find and create new customers at the counter ---
            "list_users"       => true,
            "create_users"     => true,
            "edit_users"       => true,
            "create_customers" => true,
            // --- THINGS THAT SHOULD BE LOCKED DOWN ---
            "manage_woocommerce"       => true, // Do not allow editing Settings/Currency/Payment Gateways
            "edit_theme_options"       => false, // Do not allow editing web interface
            "export"                   => false, // Prevent customer data theft
            "import"                   => false,
            "manage_shop_coupon_terms" => true, // Do not allow creating discount codes
            "edit_shop_coupons"        => true,
            "view_woocommerce_reports" => true, // Do not allow viewing monthly/yearly total revenue
        ];
        add_role(
            'yeepos_cashier',
            'Cashier YeePOS',
            $caps
        );
    }
    public function register_admin_menu()
    {
        add_menu_page(
            __('YeePOS Settings', 'yeepos'),
            __('YeePOS', 'yeepos'),
            'manage_woocommerce',
            'yeepos',
            [$this, 'admin_page_html'],
            'dashicons-store',
            56
        );
    }
    public function admin_page_html()
    {
        if (! current_user_can('manage_woocommerce') && ! current_user_can('access_yeepos')) {
            return;
        }
        $active_tab = isset($_GET['tab']) ? sanitize_text_field(wp_unslash($_GET['tab'])) : 'general'; //phpcs:ignore WordPress.Security.NonceVerification.Recommended
        if ($active_tab === 'tools') {
            $active_tab = 'addons';
        } // Redirect legacy tools tab
        // Handle Form Submission
        if (isset($_POST['yeepos_save_settings'])) {
            check_admin_referer('yeepos_settings_nonce');
            if ($active_tab === 'pwa') {
                if (isset($_POST['yeepos_pwa_name'])) {
                    update_option('yeepos_pwa_name', sanitize_text_field(wp_unslash($_POST['yeepos_pwa_name'])));
                }
                if (isset($_POST['yeepos_pwa_short_name'])) {
                    update_option('yeepos_pwa_short_name', sanitize_text_field(wp_unslash($_POST['yeepos_pwa_short_name'])));
                }
                if (isset($_POST['yeepos_pwa_theme_color'])) {
                    update_option('yeepos_pwa_theme_color', sanitize_hex_color(wp_unslash($_POST['yeepos_pwa_theme_color'])));
                }
                if (isset($_POST['yeepos_pwa_icon'])) {
                    update_option('yeepos_pwa_icon', esc_url_raw(wp_unslash($_POST['yeepos_pwa_icon'])));
                }
                if (isset($_POST['yeepos_pwa_bg_color'])) {
                    update_option('yeepos_pwa_bg_color', sanitize_hex_color(wp_unslash($_POST['yeepos_pwa_bg_color'])));
                }
            } elseif ($active_tab === 'filters') {
                if (isset($_POST['yeemenu_include_prods'])) {
                    $include_prods = array_map('intval', (array) wp_unslash($_POST['yeemenu_include_prods']));
                    update_option('yeemenu_include_prods', $include_prods);
                } else {
                    delete_option('yeemenu_include_prods');
                }
                if (isset($_POST['yeemenu_exclude_prods'])) {
                    $exclude_prods = array_map('intval', (array) wp_unslash($_POST['yeemenu_exclude_prods']));
                    update_option('yeemenu_exclude_prods', $exclude_prods);
                } else {
                    delete_option('yeemenu_exclude_prods');
                }
                if (isset($_POST['yeemenu_include_cats'])) {
                    $include_cats = array_map('sanitize_text_field', (array) wp_unslash($_POST['yeemenu_include_cats']));
                    update_option('yeemenu_include_cats', $include_cats);
                } else {
                    delete_option('yeemenu_include_cats');
                }
                if (isset($_POST['yeemenu_exclude_cats'])) {
                    $exclude_cats = array_map('sanitize_text_field', (array) wp_unslash($_POST['yeemenu_exclude_cats']));
                    update_option('yeemenu_exclude_cats', $exclude_cats);
                } else {
                    delete_option('yeemenu_exclude_cats');
                }
            }
            // Auto-flush rewrite rules
            $this->add_rewrite_rules();
            flush_rewrite_rules();
?>
            <div class="updated">
                <p><?php esc_html_e('Settings saved and routes refreshed.', 'yeepos'); ?></p>
            </div>
        <?php
        }
        $pos_url = site_url('/pos');
        ?>
        <div class="wrap">
            <h1><?php esc_html_e('YeePOS Settings', 'yeepos'); ?></h1>
            <nav class="nav-tab-wrapper" style="margin-bottom: 20px;">
                <a href="<?php echo esc_url(admin_url('admin.php?page=yeepos&tab=general')); ?>" class="nav-tab <?php echo esc_attr($active_tab == 'general' ? 'nav-tab-active' : ''); ?>"><?php esc_html_e('General', 'yeepos'); ?></a>
                <a href="<?php echo esc_url(admin_url('admin.php?page=yeepos&tab=pwa')); ?>" class="nav-tab <?php echo esc_attr($active_tab == 'pwa' ? 'nav-tab-active' : ''); ?>"><?php esc_html_e('Settings APP PWA', 'yeepos'); ?></a>
                <a href="<?php echo esc_url(admin_url('admin.php?page=yeepos&tab=addons')); ?>" class="nav-tab <?php echo esc_attr($active_tab == 'addons' ? 'nav-tab-active' : ''); ?>"><?php esc_html_e('Add-ons', 'yeepos'); ?></a>
                <a href="<?php echo esc_url(admin_url('admin.php?page=yeepos&tab=filters')); ?>" class="nav-tab <?php echo esc_attr($active_tab == 'filters' ? 'nav-tab-active' : ''); ?>"><?php esc_html_e('Product Filters', 'yeepos'); ?></a>
            </nav>
            <form method="post" action="">
                <?php wp_nonce_field('yeepos_settings_nonce'); ?>
                <div style="margin-top: 20px;">
                    <?php if ($active_tab === 'general') : ?>
                        <div class="card" style="max-width: 100%; margin-top: 0;">
                            <h2><?php esc_html_e('Application Access', 'yeepos'); ?></h2>
                            <p><?php esc_html_e('Launch the YeePOS application in a new window.', 'yeepos'); ?></p>
                            <p><a href="<?php echo esc_url($pos_url); ?>" target="_blank" class="button button-primary button-large"><?php esc_html_e('Open POS Application', 'yeepos'); ?></a></p>
                        </div>
                    <?php elseif ($active_tab === 'pwa') :
                        $pwa_name = get_option('yeepos_pwa_name', get_bloginfo('name'));
                        $pwa_short = get_option('yeepos_pwa_short_name', 'YeePOS');
                        $pwa_theme = get_option('yeepos_pwa_theme_color', '#0ea5e9');
                        $pwa_bg = get_option('yeepos_pwa_bg_color', '#ffffff');
                        $pwa_icon = get_option('yeepos_pwa_icon', YEEKIT_WOO_POS_URL . 'assets/icon-512.png');
                    ?>
                        <table class="form-table">
                            <tr>
                                <th scope="row"><label for="yeepos_pwa_name"><?php esc_html_e('App Full Name', 'yeepos'); ?></label></th>
                                <td><input name="yeepos_pwa_name" type="text" id="yeepos_pwa_name" value="<?php echo esc_attr($pwa_name); ?>" class="regular-text"></td>
                            </tr>
                            <tr>
                                <th scope="row"><label for="yeepos_pwa_short_name"><?php esc_html_e('Short Name (on Home Screen)', 'yeepos'); ?></label></th>
                                <td><input name="yeepos_pwa_short_name" type="text" id="yeepos_pwa_short_name" value="<?php echo esc_attr($pwa_short); ?>" class="regular-text"></td>
                            </tr>
                            <tr>
                                <th scope="row"><label for="yeepos_pwa_theme_color"><?php esc_html_e('Theme Color', 'yeepos'); ?></label></th>
                                <td><input name="yeepos_pwa_theme_color" type="color" id="yeepos_pwa_theme_color" value="<?php echo esc_attr($pwa_theme); ?>"> <span class="description"><?php esc_html_e('Affects the toolbar color.', 'yeepos'); ?></span></td>
                            </tr>
                            <tr>
                                <th scope="row"><label for="yeepos_pwa_icon"><?php esc_html_e('Theme Icon', 'yeepos'); ?></label></th>
                                <td>
                                    <div class="yeepos-icon-preview-wrapper" style="margin-bottom: 10px;">
                                        <img id="yeepos_pwa_icon_preview" src="<?php echo esc_url($pwa_icon); ?>" style="max-width: 120px; height: auto; display: block; border: 1px solid #ddd; padding: 4px; background: #fff; border-radius: 8px;">
                                    </div>
                                    <input name="yeepos_pwa_icon" type="hidden" id="yeepos_pwa_icon_input" value="<?php echo esc_attr($pwa_icon); ?>">
                                    <button type="button" class="button" id="yeepos_pwa_icon_button"><?php esc_html_e('Select Image', 'yeepos'); ?></button>
                                    <span class="description"><?php esc_html_e('App icon (512x512 recommended).', 'yeepos'); ?></span>
                                </td>
                            </tr>
                        </table>
                    <?php elseif ($active_tab === 'addons') : ?>
                        <div class="yeepos-addons-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 20px; margin-top: 20px;">
                            <div class="card" style="margin: 0; display: flex; flex-direction: column; padding: 20px; border-radius: 12px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
                                <img src="<?php echo esc_url(YEEKIT_WOO_POS_URL . 'assets/addon-product.png'); ?>" style="width: 100%; height: 200px; object-fit: cover; border-radius: 8px; margin-bottom: 15px;">
                                <h2 style="margin: 0 0 10px 0; font-size: 18px;"><?php esc_html_e('Product Add-on', 'yeepos'); ?></h2>
                                <p style="color: #64748b; font-size: 14px; line-height: 1.5;"><?php esc_html_e('Allow customers to customize products with extra options, toppings, and special requests directly at the counter.', 'yeepos'); ?></p>
                                <div style="margin-top: auto; padding-top: 20px; display: flex; justify-content: space-between; align-items: center;">
                                    <span style="background: #f1f5f9; color: #475569; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 700; text-transform: uppercase;"><?php esc_html_e('Coming Soon', 'yeepos'); ?></span>
                                    <button type="button" class="button button-disabled" disabled><?php esc_html_e('Activate', 'yeepos'); ?></button>
                                </div>
                            </div>
                            <div class="card" style="margin: 0; display: flex; flex-direction: column; padding: 20px; border-radius: 12px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
                                <img src="<?php echo esc_url(YEEKIT_WOO_POS_URL . 'assets/addon-menu.png'); ?>" style="width: 100%; height: 200px; object-fit: cover; border-radius: 8px; margin-bottom: 15px;">
                                <h2 style="margin: 0 0 10px 0; font-size: 18px;"><?php esc_html_e('QR Menu', 'yeepos'); ?></h2>
                                <p style="color: #64748b; font-size: 14px; line-height: 1.5;"><?php esc_html_e('Manage digital menus, create table QR codes for customers to self-order and pay via phone.', 'yeepos'); ?></p>
                                <div style="margin-top: auto; padding-top: 20px; display: flex; justify-content: space-between; align-items: center;">
                                    <span style="background: #f1f5f9; color: #475569; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 700; text-transform: uppercase;"><?php esc_html_e('Coming Soon', 'yeepos'); ?></span>
                                    <button type="button" class="button button-disabled" disabled><?php esc_html_e('Activate', 'yeepos'); ?></button>
                                </div>
                            </div>
                            <div class="card" style="margin: 0; display: flex; flex-direction: column; padding: 20px; border-radius: 12px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
                                <img src="<?php echo esc_url(YEEKIT_WOO_POS_URL . 'assets/addon-food.png'); ?>" style="width: 100%; height: 200px; object-fit: cover; border-radius: 8px; margin-bottom: 15px;">
                                <h2 style="margin: 0 0 10px 0; font-size: 18px;"><?php esc_html_e('Restaurant Management', 'yeepos'); ?></h2>
                                <p style="color: #64748b; font-size: 14px; line-height: 1.5;"><?php esc_html_e('Advanced features for restaurants: Kitchen area management, server coordination, and preparation time optimization.', 'yeepos'); ?></p>
                                <div style="margin-top: auto; padding-top: 20px; display: flex; justify-content: space-between; align-items: center;">
                                    <span style="background: #f1f5f9; color: #475569; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 700; text-transform: uppercase;"><?php esc_html_e('Coming Soon', 'yeepos'); ?></span>
                                    <button type="button" class="button button-disabled" disabled><?php esc_html_e('Activate', 'yeepos'); ?></button>
                                </div>
                            </div>
                        </div>
                    <?php elseif ($active_tab === 'filters') :
                        $include_prods = (array)get_option('yeemenu_include_prods', []);
                        $exclude_prods = (array)get_option('yeemenu_exclude_prods', []);
                        $include_cats = (array)get_option('yeemenu_include_cats', []);
                        $exclude_cats = (array)get_option('yeemenu_exclude_cats', []);
                        $all_cats = get_terms(['taxonomy' => 'product_cat', 'hide_empty' => false]);
                    ?>
                        <table class="form-table">
                            <tr>
                                <th scope="row"><label for="yeemenu_include_prods"><?php esc_html_e('Include Products', 'yeepos'); ?></label></th>
                                <td>
                                    <select name="yeemenu_include_prods[]" id="yeemenu_include_prods" class="wc-product-search regular-text" multiple="multiple" style="width: 100%;" data-placeholder="<?php esc_attr_e('Search for a product&hellip;', 'woocommerce'); //phpcs:ignore WordPress.WP.I18n.TextDomainMismatch 
                                                                                                                                                                                                        ?>" data-action="woocommerce_json_search_products_and_variations">
                                        <?php
                                        foreach ($include_prods as $product_id) {
                                            $product = wc_get_product($product_id);
                                            if (is_object($product)) {
                                                echo '<option value="' . esc_attr($product_id) . '" selected="selected">' . wp_kses_post($product->get_formatted_name()) . '</option>';
                                            }
                                        }
                                        ?>
                                    </select>
                                    <p class="description"><?php esc_html_e('Search and select products to specifically include.', 'yeepos'); ?></p>
                                </td>
                            </tr>
                            <tr>
                                <th scope="row"><label for="yeemenu_exclude_prods"><?php esc_html_e('Exclude Products', 'yeepos'); ?></label></th>
                                <td>
                                    <select name="yeemenu_exclude_prods[]" id="yeemenu_exclude_prods" class="wc-product-search regular-text" multiple="multiple" style="width: 100%;" data-placeholder="<?php esc_attr_e('Search for a product&hellip;', 'woocommerce'); //phpcs:ignore WordPress.WP.I18n.TextDomainMismatch 
                                                                                                                                                                                                        ?>" data-action="woocommerce_json_search_products_and_variations">
                                        <?php
                                        foreach ($exclude_prods as $product_id) {
                                            $product = wc_get_product($product_id);
                                            if (is_object($product)) {
                                                echo '<option value="' . esc_attr($product_id) . '" selected="selected">' . wp_kses_post($product->get_formatted_name()) . '</option>';
                                            }
                                        }
                                        ?>
                                    </select>
                                    <p class="description"><?php esc_html_e('Search and select products to exclude from sync.', 'yeepos'); ?></p>
                                </td>
                            </tr>
                            <tr>
                                <th scope="row"><label for="yeemenu_include_cats"><?php esc_html_e('Include Categories', 'yeepos'); ?></label></th>
                                <td>
                                    <select name="yeemenu_include_cats[]" id="yeemenu_include_cats" class="wc-enhanced-select regular-text" multiple="multiple" style="width: 100%;" data-placeholder="<?php esc_attr_e('Select categories&hellip;', 'yeepos'); ?>">
                                        <?php foreach ($all_cats as $cat) : ?>
                                            <option value="<?php echo esc_attr($cat->term_id); ?>" <?php selected(in_array((string)$cat->term_id, $include_cats, true)); ?>><?php echo esc_html($cat->name); ?></option>
                                        <?php endforeach; ?>
                                    </select>
                                    <p class="description"><?php esc_html_e('Only products from selected categories will be synced.', 'yeepos'); ?></p>
                                </td>
                            </tr>
                            <tr>
                                <th scope="row"><label for="yeemenu_exclude_cats"><?php esc_html_e('Exclude Categories', 'yeepos'); ?></label></th>
                                <td>
                                    <select name="yeemenu_exclude_cats[]" id="yeemenu_exclude_cats" class="wc-enhanced-select regular-text" multiple="multiple" style="width: 100%;" data-placeholder="<?php esc_attr_e('Select categories&hellip;', 'yeepos'); ?>">
                                        <?php foreach ($all_cats as $cat) : ?>
                                            <option value="<?php echo esc_attr($cat->term_id); ?>" <?php selected(in_array((string)$cat->term_id, $exclude_cats, true)); ?>><?php echo esc_html($cat->name); ?></option>
                                        <?php endforeach; ?>
                                    </select>
                                    <p class="description"><?php esc_html_e('Products from selected categories will be excluded from sync.', 'yeepos'); ?></p>
                                </td>
                            </tr>
                        </table>
                    <?php endif; ?>
                </div>
                <?php if ($active_tab !== 'addons' && $active_tab !== 'general') : ?>
                    <p class="submit">
                        <input type="submit" name="yeepos_save_settings" id="submit" class="button button-primary" value="<?php esc_html_e('Save Settings', 'yeepos'); ?>">
                    </p>
                <?php endif; ?>
            </form>
        </div>
    <?php
    }
    public function add_rewrite_rules()
    {
        add_rewrite_rule('^pos/?$', 'index.php?yeepos_app=1', 'top');
        add_rewrite_rule('^yeepos-manifest\.json$', 'index.php?yeepos_manifest=1', 'top');
        add_rewrite_rule('^yeepos-sw\.js$', 'index.php?yeepos_sw=1', 'top');
    }
    /**
     * Display the YeePOS Cashier info on the WooCommerce Order Admin screen
     */
    public function display_cashier_in_order_admin($order)
    {
        $cashier_id = $order->get_meta('_yeepos_cashier_id');
    ?>
        <p><strong><?php esc_html_e('POS Cashier', 'yeepos'); ?>:</strong>
            <?php
            if (! empty($cashier_id)) {
                $cashier_info = get_userdata($cashier_id);
                echo esc_html($cashier_info->display_name);
            } else {
                esc_html_e('Online Order', 'yeepos');
            }
            ?>
        </p>
<?php
    }
}
new Yeekit_Woo_Pos_Backend();
