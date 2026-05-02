<?php

/**
 * Plugin Name: YeePOS - PWA Point of Sale for WooCommerce W
 * Description: Offline-first Progressive Web App POS for WooCommerce retail management.
 * Version:     1.0.1
 * Author:      addonsorg
 * Requires Plugins: woocommerce
 * Author URI: https://add-ons.org/
 * Tested up to: 6.9
 * WC requires at least: 4.0
 * WC tested up to: 10.5
 * License: GPL v2 or later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 *
 */
if (! defined('ABSPATH')) {
    exit; // Exit if accessed directly
}
define('YEEKIT_WOO_POS_VERSION', '1.0.0');
define('YEEKIT_WOO_POS_PATH', plugin_dir_path(__FILE__));
define('YEEKIT_WOO_POS_URL', plugin_dir_url(__FILE__));
class Yeekit_Woo_Pos_Load
{
    public function __construct()
    {
        require_once plugin_dir_path(__FILE__) . 'rest.php';
        require_once plugin_dir_path(__FILE__) . 'backend/index.php';
        require_once plugin_dir_path(__FILE__) . 'frontend/index.php';
        add_action('query_vars', [$this, 'add_query_vars']);
        add_action('before_woocommerce_init', array($this, 'declare_hpos_compatibility'));
    }
    public function declare_hpos_compatibility()
    {
        if (class_exists(\Automattic\WooCommerce\Utilities\FeaturesUtil::class)) {
            \Automattic\WooCommerce\Utilities\FeaturesUtil::declare_compatibility(
                'custom_order_tables',
                __FILE__,
                true
            );
        }
    }
    public function add_query_vars($vars)
    {
        $vars[] = 'yeepos_app';
        $vars[] = 'yeepos_manifest';
        $vars[] = 'yeepos_sw';
        return $vars;
    }
}
new Yeekit_Woo_Pos_Load();
