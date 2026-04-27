=== YeePOS - PWA Point of Sale for WooCommerce ===
Contributors: addonsorg
Tags: woocommerce, pos, point of sale, offline pos, pwa
Requires at least: 6.0
Tested up to: 6.9
WC requires at least: 4.0
WC tested up to: 10.6
Stable tag: 1.0.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

YeePOS is an ultra-fast, offline-first Point of Sale (POS) system for WooCommerce, built as a Progressive Web App (PWA).

== Description ==

YeePOS transforms your WooCommerce store into a powerful, offline-first Point of Sale (POS) system. Designed for speed and reliability, it allows your cashiers and store managers to process orders in milliseconds, even without an active internet connection.

Built using modern web technologies (React & Progressive Web App), YeePOS installs directly on your iPad, Android tablet, or desktop computer, providing a native app-like experience.

**Demo:** <https://demo.add-ons.org/yeepos/pos>
**Documentation:** <https://add-ons.org/document-yeepos/>

### Key Features & Capabilities

**1. Unrivaled Performance & Offline Mode**
* **Offline-First Architecture**: Powered by IndexedDB, allowing uninterrupted sales even when the internet is completely disconnected.
* **Auto-Synchronization**: Orders, customers, and data are automatically synced back to WooCommerce once the connection is restored.
* **Secure REST API V3**: Built natively on top of the latest and most secure WooCommerce REST API V3 architecture for rock-solid data integrity.
* **Progressive Web App (PWA)**: Install directly to iOS, Android, macOS, or Windows devices without app store approvals. Works like a native full-screen app.
* **Hybrid Search System**: Combines instant local search with fallback online API search for massive product catalogs.
* **Optimized for Low-End Devices**: Highly efficient rendering and smart memory management ensure the app runs smoothly and responsively even on older or weaker hardware.
* **Massive Catalog Support**: Architected to effortlessly handle large-scale retail operations, easily processing huge catalogs with up to 500,000 products without any performance drops.

**2. Lightning-Fast Checkout & Cart Management**
* **Barcode & QR Code Scanning**: Built-in support for USB/Bluetooth physical barcode scanners, plus advanced camera-based Barcode and QR code scanning for mobile devices.
* **Variable & Add-on Products**: Fully supports WooCommerce product variations, custom attributes, and dynamic product add-ons.
* **Editable Cart Items**: Adjust prices, update quantities, or add custom discounts directly from the POS cart interface.
* **Coupons & Discounts**: Syncs with WooCommerce coupon settings to apply fixed or percentage discounts seamlessly.
* **Custom Tips & Surcharges**: Easily add tips (preset percentages or custom amounts) to the final bill.
* **Standard WooCommerce Tax Support**: Full compliance and seamless synchronization with standard WooCommerce tax settings, supporting both inclusive and exclusive tax configurations.

**3. Comprehensive Store & Order Management**
* **In-App Store Management**: Manage your entire inventory, customer database, and process online WooCommerce orders directly from the POS interface without needing to access the WP admin dashboard.
* **Real-Time Reporting**: Access built-in sales reports and analytics directly within the app to monitor your daily performance.
* **Hold Cart & Parked Orders**: Instantly put active carts on hold and resume them later—ideal for crowded stores, complex requests, or dine-in scenarios.
* **Customer Management**: Search, select, create, and edit WooCommerce customers on the fly.
* **Order Notes**: Add custom notes to orders for kitchen staff, packing, or special customer requests.

**4. Payments & Printing**
* **Flexible Payment Methods**: Filter and select from Cash, Cash on Delivery (COD), Direct Bank Transfer (BACS), and other custom offline gateways.
* **Online Checkout & Payments**: Send payment links or QR codes directly to the Customer Display, allowing customers to seamlessly check out using your standard WooCommerce online payment gateways (Stripe, PayPal, Apple Pay, etc.).
* **Split Payments & Change Due**: Automatically calculates balance and change due for cash transactions.
* **Thermal Receipt Printing & Cash Drawers**: Optimized layout for 58mm/80mm thermal receipt printers using native browser print capabilities, with seamless trigger support for connected cash drawers.
* **Dual Screen Support (Customer Facing Display)**: Connect a second monitor or tablet to broadcast a beautiful, live view of the cart, items, totals, and payment URLs to enhance customer transparency.

**5. Smart UI/UX & Localization**
* **Dark Mode & Light Mode**: Auto-adapts to OS settings or can be manually toggled to reduce eye strain.
* **Multi-Language & RTL Ready**: Comes with 20+ pre-installed languages out of the box. Natively supports Right-to-Left (RTL) languages like Arabic and Hebrew, dynamically adjusting layouts for a global audience.
* **Adaptive Interface**: Responsive design optimized for touch screens, iPads, Android tablets, and traditional desktop monitors.
* **Grid & List Views**: Organize products visually with a grid view or cleanly with a compact list view. Pin favorite products for quicker access.

**6. Restaurant & Multi-Branch Ready (Optional Modules)**
* **Dine-In, Takeaway & Shipping**: Select specific fulfillment service types per order.
* **Table Management**: Assign orders to specific tables for restaurants and cafes.
* **Multi-Store Management**: Limit product visibility and assign staff to specific physical branches.

### Perfect for various retail businesses:
* Retail Stores & Boutiques
* Restaurants & Cafes
* Food Trucks
* Pop-up Shops & Events
* Grocery Stores

== Installation ==

1. Upload the `yeepos` folder to the `/wp-content/plugins/` directory.
2. Activate the plugin through the 'Plugins' menu in WordPress.
3. Ensure WooCommerce is active.
4. Go to **WooCommerce > Settings > YeePOS** to configure your store settings, receipt details, and tax configurations.
5. Open the POS app by navigating to your WordPress admin dashboard and clicking on the **YeePOS** menu item, or by visiting `/pos` directly.

== Frequently Asked Questions ==

= Does YeePOS work without the internet? =
Yes! YeePOS is designed to be offline-first. As long as you have synced your products and customers while online, you can continue to create orders offline. The orders will automatically sync back to WooCommerce once the internet connection is restored.

= Can I use a barcode scanner? =
Absolutely. YeePOS supports standard USB and Bluetooth barcode scanners. Just click on the search bar or use the scanner shortcut, and scan your products' SKUs.

= Can I install it as an app on my iPad? =
Yes. Open the POS URL in Safari on your iPad, tap the "Share" button, and select "Add to Home Screen". It will launch in full-screen mode like a native iOS app.

= Does it support calculating taxes? =
Yes, YeePOS reads your WooCommerce tax settings and applies them accurately to the POS cart, supporting both inclusive and exclusive tax configurations.

= What happens if I close the app while offline? =
Your data is safe. YeePOS stores all pending orders and local data securely in your browser's IndexedDB. When you reopen the app and connect to the internet, it will automatically resume syncing.

== Screenshots ==

1. **POS Dashboard**: A clean, intuitive interface for fast order processing.
2. **Offline Mode**: Seamlessly continue selling when the connection drops.
3. **Product Variations**: Easy selection of product attributes and add-ons.
4. **Parked Orders**: Manage ongoing and paused orders efficiently.

== Changelog ==

= 1.0.0 =
* Initial Release.
* Added Offline-first capabilities with IndexedDB synchronization.
* Implemented PWA support for desktop and mobile installation.
* Added Barcode scanning, Parked Orders, and Multi-language RTL support.
* Integrated dynamic tax calculation and flexible payment gateways.
