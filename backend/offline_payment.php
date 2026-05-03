<?php

/**
 * Minimal Gateway Classes for YeePOS
 */
if (class_exists('WC_Payment_Gateway')) {
    /**
     * YeePOS Cash Gateway
     */
    class WC_Gateway_YeePOS_Cash extends WC_Payment_Gateway
    {
        public function __construct()
        {
            $this->id = 'cash';
            $this->icon = '';
            $this->has_fields = false;
            $this->method_title = 'YeePOS Cash';
            $this->method_description = 'Accept physical cash payments at the point of sale.';
            $this->init_form_fields();
            $this->init_settings();
            $this->title = $this->get_option('title', 'Cash');
            $this->description = $this->get_option('description', 'Pay with cash at the counter.');
            add_action('woocommerce_update_options_payment_gateways_' . $this->id, array($this, 'process_admin_options'));
        }
        public function init_form_fields()
        {
            $this->form_fields = array(
                'enabled' => array('title' => 'Enable/Disable', 'type' => 'checkbox', 'default' => 'yes'),
                'title' => array('title' => 'Title', 'type' => 'text', 'default' => 'Cash')
            );
        }
        public function process_payment($order_id)
        {
            $order = wc_get_order($order_id);
            $order->payment_complete();
            wc_reduce_stock_levels($order_id);
            WC()->cart->empty_cart();
            return array('result' => 'success', 'redirect' => $this->get_return_url($order));
        }
    }
    /**
     * YeePOS Chip and Pin Gateway
     */
    class WC_Gateway_YeePOS_Chip_And_Pin extends WC_Payment_Gateway
    {
        public function __construct()
        {
            $this->id = 'chip_and_pin';
            $this->icon = '';
            $this->has_fields = false;
            $this->method_title = 'YeePOS Chip & Pin';
            $this->method_description = 'Accept card payments via external terminal.';
            $this->init_form_fields();
            $this->init_settings();
            $this->title = $this->get_option('title', 'Chip and Pin');
            $this->description = $this->get_option('description', 'Secure terminal payment.');
            add_action('woocommerce_update_options_payment_gateways_' . $this->id, array($this, 'process_admin_options'));
        }
        public function init_form_fields()
        {
            $this->form_fields = array(
                'enabled' => array('title' => 'Enable/Disable', 'type' => 'checkbox', 'default' => 'yes'),
                'title' => array('title' => 'Title', 'type' => 'text', 'default' => 'Chip and Pin')
            );
        }
        public function process_payment($order_id)
        {
            $order = wc_get_order($order_id);
            $order->update_status('processing', 'Awaiting terminal confirmation.');
            wc_reduce_stock_levels($order_id);
            WC()->cart->empty_cart();
            return array('result' => 'success', 'redirect' => $this->get_return_url($order));
        }
    }
}
