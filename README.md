# Habit Tracker Pro 📈

A beautiful, feature-rich habit tracking web application built with HTML, CSS, and JavaScript. Track your daily routines, visualize progress with interactive charts, and build better habits!

## 🌟 Features

### 📊 Visual Analytics
- **Progress Charts**: Beautiful donut charts showing daily completion percentage
- **Bar Charts**: Weekly and monthly progress visualization
- **Pie Charts**: Habit distribution by category
- **Streak Analysis**: Track your longest streaks and current progress

### 🎯 Habit Management
- **CRUD Operations**: Add, edit, and delete habits easily
- **Categories**: Organize habits by Health, Productivity, Learning, Mindfulness, Social, Creativity, and more
- **Frequency Settings**: Daily, weekly, or custom day scheduling
- **Target Tracking**: Set specific targets with units (e.g., 8 glasses of water)

### 📅 Calendar View
- **Monthly Calendar**: Visual representation of daily progress
- **Progress Indicators**: See completion rates for each day
- **Navigation**: Easy month-to-month browsing

### 📱 Modern UI/UX
- **Responsive Design**: Works on desktop, tablet, and mobile
- **Beautiful Gradients**: Eye-catching color schemes
- **Smooth Animations**: Polished interactions and transitions
- **Dark/Light Themes**: Automatically adapts to system preferences

### 💾 Data Management
- **Local Storage**: All data saved locally in your browser
- **Export Feature**: Download your data as JSON for backup
- **Import Feature**: Restore data from JSON backup files
- **Cross-Device Sync**: Transfer habits between different devices/browsers
- **Sample Data**: Comes with sample habits for demonstration

## 🚀 Getting Started

### Option 1: Simple File Opening
1. Download all files (`index.html`, `styles.css`, `script.js`)
2. Open `index.html` in your web browser
3. Start tracking your habits!

### Option 2: Local Server (Recommended)
1. Navigate to the project folder in terminal
2. Start a local server:
   - **Python**: `python -m http.server 8080`
   - **Node.js**: `npx serve -p 8080`
   - **Live Server**: Use VS Code Live Server extension
3. Open `http://localhost:8080` in your browser

## 📋 How to Use

### Adding Your First Habit
1. Click the "+" button or "Add New Habit"
2. Fill in the habit details:
   - **Name**: What you want to track (e.g., "Drink 8 glasses of water")
   - **Description**: Optional details about the habit
   - **Category**: Choose from predefined categories
   - **Frequency**: Daily, weekly, or custom days
   - **Target & Unit**: Optional numerical goals
3. Click "Save Habit"

### Daily Tracking
1. Go to the Dashboard tab
2. Click the circle icon next to each habit to mark as complete
3. Watch your progress charts update in real-time!

### Viewing Analytics
1. Navigate to the Analytics tab
2. View different chart types:
   - Monthly progress trends
   - Habit distribution by category
   - Streak analysis for all habits
3. Check your statistics for motivation

### Calendar Overview
1. Switch to the Calendar tab
2. See monthly view with progress indicators
3. Navigate between months to see historical data

## 🎨 Customization

### Adding Custom Categories
Edit the JavaScript file to add new categories:
```javascript
// In the getCategoryIcon() and getCategoryName() methods
const icons = {
    health: '🏃',
    productivity: '📈',
    // Add your custom category here
    custom: '🎯'
};
```

### Changing Colors
Modify the CSS variables for easy theme customization:
```css
:root {
    --primary-color: #667eea;
    --secondary-color: #764ba2;
    --success-color: #11998e;
    --danger-color: #fc466b;
}
```

## 📊 Chart Libraries Used

- **Chart.js**: For creating beautiful, responsive charts
- **Font Awesome**: For icons throughout the application
- **Google Fonts**: Poppins font family for modern typography

## 🔧 Technical Details

### Browser Compatibility
- Chrome 60+
- Firefox 55+
- Safari 12+
- Edge 79+

### Storage
- Uses localStorage for data persistence
- No server required
- Data stays on your device
- Full import/export functionality for backups and transfers

### Performance
- Lightweight (~500KB total)
- Fast loading and responsive
- Optimized for mobile devices

## 🎯 Sample Habits Included

The app comes with sample habits to demonstrate features:
- 💧 Drink 8 glasses of water (Daily)
- 📚 Read for 30 minutes (Daily)
- 🏃 Exercise (Monday, Wednesday, Friday)

You can delete these and add your own habits!

## 🔄 Data Management

### Export Your Data
1. Click "Export Data" in the dashboard
2. Save the JSON file as backup
3. Use this file to transfer between devices or as backup

### Import Your Data
1. Click "Import Data" in the dashboard
2. Select your previously exported JSON file
3. Confirm the import to restore all habits and progress

### Transfer Between Devices
**From Device A to Device B:**
1. **Export** data from Device A (saves JSON file)
2. Transfer JSON file to Device B (USB, email, cloud storage)
3. **Import** the JSON file on Device B
4. All habits and streaks are now on both devices!

### Cross-Browser Transfer
Move your habits between Chrome, Firefox, Safari, Edge:
1. Export from Browser A → Import to Browser B
2. Works seamlessly across all modern browsers

### Reset Everything
To start fresh, clear your browser's localStorage for this site.

## 🌟 Pro Tips

1. **Start Small**: Begin with 2-3 easy habits
2. **Be Consistent**: Better to do something small daily than big things irregularly
3. **Use Categories**: Group similar habits for better organization
4. **Check Analytics**: Use the charts to identify patterns and motivation
5. **Regular Backups**: Export your data weekly/monthly for safety
6. **Multi-Device Usage**: Export from laptop, import to desktop for seamless tracking
7. **Set Realistic Targets**: Don't overwhelm yourself with too many habits at once

## 🤝 Contributing

Feel free to enhance this application! Some ideas:
- Add more chart types
- Implement habit reminders
- Add social features
- Create habit templates
- Add data import/export options

## 📝 License

This project is open source. Feel free to use, modify, and distribute as needed.

## 🎉 Enjoy Building Better Habits!

Start your journey to better habits today! Remember, small consistent actions lead to big transformations. 💪✨