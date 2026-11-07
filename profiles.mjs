// Phone profiles. Width and height are CSS pixels.
const android = (label, width, height, wmSize, density, extra = {}) => ({
  label, width, height, platform: 'android', android: { wmSize, density, ...extra },
});
const ios = (label, width, height) => ({ label, width, height, platform: 'ios' });

export const PROFILES = {
  // Tier 1: Chrome at phone sizes.
  p320: { label: '320×568 smallest phone', width: 320, height: 568, dpr: 2, platform: 'android' },
  p360: { label: '360×740 small Android', width: 360, height: 740, dpr: 3, platform: 'android' },
  p390: { label: '390×844 common iPhone size', width: 390, height: 844, dpr: 3, platform: 'android' },
  p412: { label: '412×915 large Android', width: 412, height: 915, dpr: 2.625, platform: 'android' },
  p430: { label: '430×932 largest phones', width: 430, height: 932, dpr: 3, platform: 'android' },
  landscape: { label: '844×390 phone sideways', width: 844, height: 390, dpr: 3, platform: 'android' },
  dark390: { label: '390×844 dark theme', width: 390, height: 844, dpr: 3, platform: 'android', theme: 'dark' },

  // Tier 2: Android emulator. 640/320 = 2x, 1080/420 = 2.625x, 1170/480 = 3x.
  'a36-320': android('Android 16, 320 wide', 320, 568, '640x1136', 320),
  'a36-412': android('Android 16, 412 wide', 412, 915, '1080x2400', 420),
  'a36-land': android('Android 16, 844 sideways', 844, 390, '1170x2532', 480, { rotate: 1 }),
  'a36-font': android('Android 16, 412 wide, text 130%', 412, 915, '1080x2400', 420, { fontScale: 1.3 }),
  'a35-320': android('Android 15, 320 wide', 320, 568, '640x1136', 320),
  'a35-412': android('Android 15, 412 wide', 412, 915, '1080x2400', 420),
  'a31-320': android('Android 12 old Chrome, 320 wide', 320, 568, '640x1136', 320),
  'a31-412': android('Android 12 old Chrome, 412 wide', 412, 915, '1080x2400', 420),
  'a30-320': android('Android 11 old Chrome, 320 wide', 320, 568, '640x1136', 320),
  'a30-412': android('Android 11 old Chrome, 412 wide', 412, 915, '1080x2400', 420),

  // Tier 3: iOS Simulator. Width is fixed by the device.
  'ios-se': ios('iPhone SE (3rd generation)', 375, 667),
  'ios-16': ios('iPhone 16', 393, 852),
  'ios-17': ios('iPhone 17', 402, 874),
  'ios-17pm': ios('iPhone 17 Pro Max', 440, 956),
};
