/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = (config) => ({
  type: "widget",
  name: "PlanmoniWidget",
  displayName: "Up Next",
  deploymentTarget: "15.1",
  colors: {
    $accent: "#3B82F6",
  },
  entitlements: {
    "com.apple.security.application-groups":
      config.ios.entitlements["com.apple.security.application-groups"],
  },
});
