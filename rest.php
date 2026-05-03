<?php
if (! defined('ABSPATH')) {
    exit; // Exit if accessed directly
}
class YeePOS_REST_Controller
{
    public function __construct()
    {
        add_action('woocommerce_rest_prepare_product_object', [$this, 'woocommerce_rest_prepare_product_object'], 10, 3);
        add_action('rest_api_init', [$this, 'register_routes']);
        add_filter('woocommerce_rest_prepare_shop_order_object', [$this, 'add_payment_url_to_rest_response'], 10, 3);
        add_filter('woocommerce_can_pay_for_order', [$this, 'yeepos_can_pay_for_order'], 10, 2);
        add_filter('woocommerce_order_is_paid_customer_check_enabled', [$this, "yeepos_can_pay_for_order_user"], 10, 1);
        add_filter('user_has_cap', [$this, 'yeepos_give_pay_capability'], 10, 4);
        add_filter('woocommerce_available_payment_gateways', [$this, 'yeepos_filter_payment_gateways']);
        add_filter('woocommerce_rest_product_object_query', [$this, 'filter_products_by_sync_settings'], 10, 2);
        add_filter('woocommerce_rest_product_cat_query', [$this, 'filter_categories_by_sync_settings'], 10, 2);
        add_filter('woocommerce_payment_gateways', [$this, 'register_custom_gateways']);
        add_filter('woocommerce_rest_product_collection_params', [$this, 'allow_unlimited_per_page'], 10, 2);
    }
    public function register_custom_gateways($gateways)
    {
        $gateways[] = 'WC_Gateway_YeePOS_Cash';
        $gateways[] = 'WC_Gateway_YeePOS_Chip_And_Pin';
        return $gateways;
    }
    public function yeepos_filter_payment_gateways($available_gateways)
    {
        // if (!isset($_GET['pos_pay'])) { //phpcs:ignore WordPress.Security.NonceVerification.Recommended
        //     return $available_gateways;
        // }
        $offline_gateways = get_option('yeepos_offline_disabled_gateways', ['cod', 'cheque', 'bacs']);
        $offline_gateways = array_merge($offline_gateways, ['cash', 'chip_and_pin']);
        foreach ($offline_gateways as $gateway_id) {
            if (isset($available_gateways[$gateway_id])) {
                unset($available_gateways[$gateway_id]);
            }
        }
        return $available_gateways;
    }
    public function yeepos_give_pay_capability($allcaps, $caps, $args, $user)
    {
        if (isset($args[0]) && $args[0] === 'pay_for_order') {
            $is_staff = user_can($user, 'manage_woocommerce') || user_can($user, 'access_yeepos');
            if (isset($_GET['pos_pay']) && $is_staff) { //phpcs:ignore WordPress.Security.NonceVerification.Recommended
                $allcaps['pay_for_order'] = true;
            }
        }
        return $allcaps;
    }
    public function yeepos_can_pay_for_order($can_pay, $order)
    {
        if (isset($_GET['pos_pay'])) { //phpcs:ignore WordPress.Security.NonceVerification.Recommended
            return true;
        }
        return $can_pay;
    }
    function yeepos_can_pay_for_order_user($enabled)
    {
        return false;
        $can_access = current_user_can('manage_woocommerce') || current_user_can('access_yeepos');
        if (isset($_GET['pos_pay']) && $can_access) { //phpcs:ignore WordPress.Security.NonceVerification.Recommended
            return false;
        }
        return $enabled;
    }
    public function add_payment_url_to_rest_response($response, $order, $request)
    {
        $data = $response->get_data();
        $data['payment_url'] = add_query_arg('pos_pay', $order->get_id(), $order->get_checkout_payment_url());
        $response->set_data($data);
        return $response;
    }
    //product add-on
    public function woocommerce_rest_prepare_product_object($response, $product, $request)
    {
        $custom_val = get_post_meta($product->get_id(), '_yeemenu_addons', true);
        $response->data['_yeepos_addons'] = $custom_val;
        return $response;
    }
    public function register_routes()
    {
        register_rest_route('yeepos/v1', '/orders', [
            'methods' => 'GET',
            'callback' => [$this, 'get_orders'],
            'permission_callback' => function () {
                return is_user_logged_in() && (current_user_can('manage_woocommerce') || current_user_can('access_yeepos'));
            }
        ]);
        register_rest_route('yeepos/v1', '/login', [
            'methods' => 'POST',
            'callback' => [$this, 'handle_login'],
            'permission_callback' => '__return_true'
        ]);
        register_rest_route('yeepos/v1', '/captcha', [
            'methods' => 'GET',
            'callback' => [$this, 'handle_captcha_challenge'],
            'permission_callback' => '__return_true'
        ]);
        register_rest_route('yeepos/v1', '/stores', [
            'methods' => 'GET',
            'callback' => [$this, 'handle_stores'],
            'permission_callback' => function () {
                return is_user_logged_in() && (current_user_can('manage_woocommerce') || current_user_can('access_yeepos'));
            }
        ]);
        register_rest_route('yeepos/v1', '/logout', array(
            'methods' => 'POST',
            'callback' => function () {
                wp_logout();
                wp_clear_auth_cookie(); // Explicitly clear cookies
                if (session_id()) {
                    session_destroy();
                }
                $response = new WP_REST_Response([
                    'status' => 'success',
                    'message' => 'Logged out from YeePOS'
                ], 200);
                $response->header('Set-Cookie', 'wordpress_logged_in_=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/');
                return $response;
            },
            'permission_callback' => '__return_true'
        ));
        // Lightweight product search for POS (Cache-on-Demand)
        register_rest_route('yeepos/v1', '/search-products', [
            'methods' => 'GET',
            'callback' => [$this, 'handle_search_products'],
            'permission_callback' => function () {
                return is_user_logged_in() && (current_user_can('manage_woocommerce') || current_user_can('access_yeepos'));
            }
        ]);
        // Send Email Receipt
        register_rest_route('yeepos/v1', '/send-email-receipt', [
            'methods' => 'POST',
            'callback' => [$this, 'handle_send_email_receipt'],
            'permission_callback' => function () {
                return is_user_logged_in() && (current_user_can('manage_woocommerce') || current_user_can('access_yeepos'));
            }
        ]);
        // Nonce Refresh for long-running sessions
        register_rest_route('yeepos/v1', '/refresh-nonce', [
            'methods' => 'GET',
            'callback' => function () {
                return new WP_REST_Response([
                    'nonce' => wp_create_nonce('wp_rest')
                ], 200);
            },
            'permission_callback' => function () {
                return is_user_logged_in() && (current_user_can('manage_woocommerce') || current_user_can('access_yeepos'));
            }
        ]);
    }
    public function handle_send_email_receipt($request)
    {
        $order_id = $request->get_param('order_id');
        $email = $request->get_param('email');
        if (!is_email($email)) {
            return new WP_REST_Response(['status' => 'error', 'message' => 'Email invalid'], 400);
        }
        $order = wc_get_order($order_id);
        if (!$order) {
            return new WP_REST_Response(['status' => 'error', 'message' => 'Order not found'], 404);
        }
        $change_recipient = function ($recipient, $object) use ($email, $order_id) {
            if ($object && $object->get_id() == $order_id) {
                return $email;
            }
            return $recipient;
        };
        add_filter('woocommerce_email_recipient_customer_invoice', $change_recipient, 10, 2);
        $mailer = WC()->mailer();
        $email_to_send = $mailer->get_emails()['WC_Email_Customer_Invoice'];
        $email_to_send->trigger($order_id, $order);
        remove_filter('woocommerce_email_recipient_customer_invoice', $change_recipient);
        return new WP_REST_Response(['status' => 'success', 'message' => 'Sent to ' . $email], 200);
    }
    /**
     * Lightweight product search — returns only the fields POS needs
     * ~200B per product vs ~5KB from WC REST API
     */
    public function handle_search_products($request)
    {
        $search   = sanitize_text_field($request->get_param('search') ?: '');
        $per_page = min(absint($request->get_param('per_page') ?: 20), 100);
        if (empty($search)) {
            return new WP_REST_Response([], 200);
        }
        // Step 1: Clean args without meta_query to avoid poor WP performance
        $args = [
            'post_type'      => 'product',
            'post_status'    => 'publish',
            'posts_per_page' => $per_page,
            'fields'         => 'ids',
            'yee_search_term' => $search, // Temporary variable for filter identification
        ];

        // Apply Sync Filters
        $args = $this->apply_sync_filters($args);
        // Step 2: Use posts_clauses filter for SQL optimization
        $search_filter = function ($clauses, $query) {
            global $wpdb;
            $term = $query->get('yee_search_term');
            if (!$term) return $clauses;
            $like = '%' . $wpdb->esc_like($term) . '%';
            // JOIN meta table for SKU retrieval
            $clauses['join'] .= " LEFT JOIN {$wpdb->postmeta} AS yee_meta ON ({$wpdb->posts}.ID = yee_meta.post_id AND yee_meta.meta_key = '_sku')";
            // WHERE: Search in Title OR SKU
            $clauses['where'] .= $wpdb->prepare(
                " AND ({$wpdb->posts}.post_title LIKE %s OR yee_meta.meta_value LIKE %s)",
                $like,
                $like
            );
            // Group by ID to prevent duplicates if product has multiple meta rows
            $clauses['groupby'] = "{$wpdb->posts}.ID";
            return $clauses;
        };
        add_filter('posts_clauses', $search_filter, 10, 2);
        $query = new WP_Query($args);
        remove_filter('posts_clauses', $search_filter, 10);
        $products = [];
        // Step 3: Loop through results and format data
        foreach ($query->posts as $product_id) {
            $product = wc_get_product($product_id);
            if (!$product || !$product->is_visible()) {
                continue;
            }
            $image_id  = $product->get_image_id();
            $image_url = $image_id ? wp_get_attachment_image_url($image_id, 'woocommerce_thumbnail') : '';
            // Categories
            $cat_terms  = wp_get_post_terms($product_id, 'product_cat', ['fields' => 'all']);
            $categories = [];
            if (!is_wp_error($cat_terms)) {
                foreach ($cat_terms as $term) {
                    $categories[] = ['id' => $term->term_id, 'name' => $term->name, 'slug' => $term->slug];
                }
            }
            $addons = get_post_meta($product_id, '_yeemenu_addons', true);
            $products[] = [
                'id'                => $product_id,
                'name'              => $product->get_name(),
                'type'              => $product->get_type(),
                'price'             => (float) $product->get_price(),
                'regular_price'     => $product->get_regular_price(),
                'sale_price'        => $product->get_sale_price(),
                'sku'               => $product->get_sku() ?: 'SKU-' . $product_id,
                'image'             => $image_url,
                'stock'             => $product->get_stock_quantity() ?: 0,
                'manage_stock'      => $product->get_manage_stock(),
                'sold_individually' => $product->get_sold_individually(),
                'categories'        => $categories,
                'meta_data'         => [],
                '_yeepos_addons'    => !empty($addons) ? $addons : [],
            ];
        }
        return new WP_REST_Response($products, 200);
    }
    public function handle_captcha_challenge($request)
    {
        $a = wp_rand(1, 9);
        $b = wp_rand(1, 9);
        $challenge_id = uniqid('yee_', true);
        // Store result in transient for 10 minutes
        set_transient('yeepos_captcha_' . $challenge_id, $a + $b, 10 * MINUTE_IN_SECONDS);
        return new WP_REST_Response([
            'a' => $a,
            'b' => $b,
            'challenge_id' => $challenge_id
        ], 200);
    }
    public function handle_stores($request)
    {
        $branches = get_option('yeemenu_store_branches', array());
        $enabled_branches = array();
        if (is_array($branches) && !empty($branches)) {
            foreach ($branches as $index => $branch) {
                $is_enabled = isset($branch['enabled']) ? wc_string_to_bool($branch['enabled']) : false;
                if ($is_enabled && !empty($branch['name'])) {
                    $branch_val = 'branch_' . esc_attr($index);
                    $enabled_branches[$branch_val] = array(
                        'name'    => esc_html($branch['name']),
                        'address' => isset($branch['address']) ? esc_html($branch['address']) : '',
                        'phone'   => isset($branch['phone']) ? esc_html($branch['phone']) : '',
                        'email'   => isset($branch['email']) ? esc_html($branch['email']) : ''
                    );
                }
            }
        }
        // Fallback
        if (empty($enabled_branches)) {
            $store_city = get_option('woocommerce_store_city', '');
            $store_address = get_option('woocommerce_store_address', '');
            $fallback_addr = trim($store_address . (!empty($store_city) ? ', ' . $store_city : ''));
            $enabled_branches['main_branch'] = array(
                'name'    => esc_html__('Main Branch', 'yeepos'),
                'address' => $fallback_addr,
                'phone'   => '',
                'email'   => ''
            );
        }
        return $enabled_branches;
    }
    public function handle_login($request)
    {
        $params = $request->get_json_params();
        $username = isset($params['username']) ? sanitize_text_field(wp_unslash($params['username'])) : '';
        $password = isset($params['password']) ? sanitize_text_field(wp_unslash($params['password'])) : '';
        $captcha_result = isset($params['captcha_result']) ? intval(wp_unslash($params['captcha_result'])) : 0;
        $challenge_id = isset($params['challenge_id']) ? sanitize_text_field(wp_unslash($params['challenge_id'])) : '';
        // Validate Captcha first
        if (empty($challenge_id)) {
            return new WP_Error('missing_captcha', 'Missing security verification data.', ['status' => 400]);
        }
        $expected = get_transient('yeepos_captcha_' . $challenge_id);
        if ($expected === false) {
            return new WP_Error('captcha_expired', 'Security code expired. Please try again.', ['status' => 400]);
        }
        if ($captcha_result !== intval($expected)) {
            delete_transient('yeepos_captcha_' . $challenge_id); // Force new challenge on failure
            return new WP_Error('captcha_failed', 'Incorrect security verification result.', ['status' => 400]);
        }
        // Cleanup after successful validation
        delete_transient('yeepos_captcha_' . $challenge_id);
        if (empty($username) || empty($password)) {
            return new WP_Error('missing_fields', 'Please enter both username and password.', ['status' => 400]);
        }
        $credentials = [
            'user_login'    => $username,
            'user_password' => $password,
            'remember'      => true
        ];
        $user = wp_signon($credentials, false);
        if (is_wp_error($user)) {
            return new WP_Error('login_failed', 'Incorrect username or password.', ['status' => 401]);
        }
        // Check if user has permission to use POS
        if (!user_can($user, 'manage_woocommerce') && !user_can($user, 'access_yeepos')) {
            wp_logout();
            wp_clear_auth_cookie(); // Explicitly clear cookies
            if (session_id()) {
                session_destroy();
            }
            $response = new WP_REST_Response([
                'status' => 'success',
                'message' => __('You do not have permission to access.', 'yeepos')
            ], 200);
            $response->header('Set-Cookie', 'wordpress_logged_in_=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/');
            return $response;
        }
        // Create session token manually so we can generate a matching nonce
        $expiration = time() + (14 * DAY_IN_SECONDS);
        $manager = WP_Session_Tokens::get_instance($user->ID);
        $token = $manager->create($expiration);
        // Set auth cookie using OUR token  
        wp_set_current_user($user->ID);
        wp_set_auth_cookie($user->ID, true, '', $token);
        // Fake $_COOKIE for the current request so wp_get_session_token() 
        // returns the correct token and wp_create_nonce() generates a valid nonce
        $logged_in_cookie = wp_generate_auth_cookie($user->ID, $expiration, 'logged_in', $token);
        $_COOKIE[LOGGED_IN_COOKIE] = $logged_in_cookie;
        return [
            'success' => true,
            'user' => [
                'id'           => $user->ID,
                'display_name' => $user->display_name,
                'user_email'   => $user->user_email,
                'avatar'       => get_avatar_url($user->ID),
                'roles'        => $user->roles,
                'nonce'        => wp_create_nonce('wp_rest'),
            ]
        ];
    }
    /**
     * Apply sync filters to WooCommerce REST API product queries
     */
    public function filter_products_by_sync_settings($args, $request)
    {
        return $this->apply_sync_filters($args);
    }

    /**
     * Apply sync filters to WooCommerce REST API category queries
     */
    public function filter_categories_by_sync_settings($args, $request)
    {
        $include_cats = get_option('yeemenu_include_cats', []);
        $exclude_cats = get_option('yeemenu_exclude_cats', []);

        if (!empty($include_cats) && is_array($include_cats)) {
            $args['include'] = !empty($args['include']) ? array_intersect((array)$args['include'], $include_cats) : $include_cats;
            if (empty($args['include'])) {
                $args['include'] = [0];
            }
        }

        if (!empty($exclude_cats) && is_array($exclude_cats)) {
            $args['exclude'] = array_merge((array)($args['exclude'] ?? []), $exclude_cats);
        }

        return $args;
    }

    /**
     * Helper to apply Include/Exclude filters to WP_Query args
     */
    private function apply_sync_filters($args)
    {
        $include_prods = get_option('yeemenu_include_prods', []);
        $exclude_prods = get_option('yeemenu_exclude_prods', []);
        $include_cats = get_option('yeemenu_include_cats', []);
        $exclude_cats = get_option('yeemenu_exclude_cats', []);

        // Filter by Product IDs
        if (!empty($include_prods) && is_array($include_prods)) {
            $args['post__in'] = !empty($args['post__in']) ? array_intersect((array)$args['post__in'], $include_prods) : $include_prods;
            if (empty($args['post__in'])) {
                $args['post__in'] = [0]; // Force empty result if intersection is empty
            }
        }

        if (!empty($exclude_prods) && is_array($exclude_prods)) {
            $args['post__not_in'] = array_merge((array)($args['post__not_in'] ?? []), $exclude_prods);
        }

        // Filter by Categories
        $tax_query = (array)($args['tax_query'] ?? []);

        if (!empty($include_cats) && is_array($include_cats)) {
            $tax_query[] = [
                'taxonomy' => 'product_cat',
                'field'    => 'term_id',
                'terms'    => $include_cats,
                'operator' => 'IN',
            ];
        }

        if (!empty($exclude_cats) && is_array($exclude_cats)) {
            $tax_query[] = [
                'taxonomy' => 'product_cat',
                'field'    => 'term_id',
                'terms'    => $exclude_cats,
                'operator' => 'NOT IN',
            ];
        }

        if (!empty($tax_query)) {
            if (count($tax_query) > 1) {
                $tax_query['relation'] = 'AND';
            }
            $args['tax_query'] = $tax_query;
        }

        return $args;
    }

    public function allow_unlimited_per_page($params, $post_type)
    {
        if (isset($params['per_page'])) {
            $params['per_page']['maximum'] = 1000000;
        }
        return $params;
    }
}
new YeePOS_REST_Controller();
