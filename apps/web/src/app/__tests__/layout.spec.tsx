import { viewport } from "../layout";

describe("RootLayout viewport export", () => {
  it("declares a device-width viewport with safe-area cover", () => {
    expect(viewport).toMatchObject({
      width: "device-width",
      initialScale: 1,
      viewportFit: "cover",
    });
  });

  it("opts into Chromium's resizes-content interactive widget", () => {
    expect(viewport).toMatchObject({ interactiveWidget: "resizes-content" });
  });
});
