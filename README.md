# YeePOS - PWA Point of Sale for WooCommerce

YeePOS is a modern, high-performance Cloud Point of Sale (POS) system built specifically for WooCommerce. It transforms your store into a powerful retail station with a stunning UI, offline capabilities, and deep WooCommerce integration.

## Key Features

### Modern POS Experience
- **Premium Design**: Sleek, glassmorphism UI with support for **Dark Mode** and **Light Mode**.
- **Lightning Fast**: Built with React and Vite for near-instant interaction.
- **Offline First**: Uses IndexedDB (Dexie.js) to cache data locally, allowing you to browse products and manage carts even with a shaky connection.

### PWA & Mobile Ready
- **Installable**: Full Progressive Web App (PWA) support. Install YeePOS on your iOS or Android home screen.
- **Immersive**: Custom status bar colors and splash screens for a native app feel.
- **Custom Branding**: Easily upload your own logo and set theme colors directly from the WordPress admin.

### Advanced Product Filters
- **Include/Exclude Rules**: Full control over what products and categories are synced to your POS.
- **AJAX Search**: Professional search-based selection for products and categories in the settings panel.
- **Granular Sync**: Ensure your POS only shows the items you actually sell at the counter.

### Add-ons Ecosystem
- **Product Add-ons**: Support for toppings, extra options, and special requests.
- **QR Menu**: Table-side ordering and digital menus for restaurants.
- **Restaurant Management**: Kitchen display systems and server coordination.

### Global Ready
- **Multi-language**: Native support for **20 languages**:
  - 🇺🇸 English, 🇻🇳 Vietnamese, 🇸🇦 Arabic (RTL), 🇮🇳 Hindi, 🇹🇭 Thai
  - 🇨🇳 Chinese, 🇯🇵 Japanese, 🇰🇷 Korean, 🇮🇩 Indonesian, 🇲🇾 Malay
  - 🇫🇷 French, 🇩🇪 German, 🇪🇸 Spanish, 🇮🇹 Italian, 🇵🇹 Portuguese
  - 🇳🇱 Dutch, 🇵🇱 Polish, 🇷🇺 Russian, 🇹🇷 Turkish, 🇬🇷 Greek
- **Flexible Currency**: Automatically inherits WooCommerce currency and tax settings.

## Installation

1. Upload the `yeepos` folder to the `/wp-content/plugins/` directory.
2. Activate the plugin through the 'Plugins' menu in WordPress.
3. Navigate to **YeePOS > Settings** to configure your PWA and Product Filters.
4. Click the **Open POS** button to launch your new retail station.

## Requirements

- WordPress 5.0+
- WooCommerce 4.0+
- PHP 7.4+
- HTTPS (Required for PWA features)

## Developer Info

This plugin is divided into three main parts:
- **Backend**: PHP/WordPress logic for settings and authentication.
- **REST API**: Custom endpoints for high-speed data synchronization.
- **Frontend (App)**: A React-based Single Page Application (SPA) located in the `/app` directory.

---
Developed by **add-ons.org**
