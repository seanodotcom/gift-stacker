
function applyTheme(theme) {
    document.body.className = `theme-${theme}`;

    // Update Snow System
    // Only standard has no snow? Actually user previous code had:
    // if Christmas: snow active.
    // Standard: snow NOT active.

    if (theme === 'christmas') {
        if (christmasBg) christmasBg.style.display = 'block';
        if (snowSystem) {
            snowSystem.active = true;
            // Restart loop if it was stopped
            snowSystem.updateLoop();
        }
    } else {
        if (christmasBg) christmasBg.style.display = 'none';
        if (snowSystem) snowSystem.active = false;
    }

    currentTheme = theme;
    localStorage.setItem('giftStackerTheme', theme);

    updateThemeButtonsUI();
}
