/** Canonical brand assets and lockup dimensions shared by generated artifacts.
 * The same asset, height, and proportional width are used in each medium's
 * header and footer so the lockup never appears faded or mismatched. */
export const BRAND_ASSETS = {
  qapita: "qapita.png",
  naspp: "naspp-transparent.png",
} as const;

export const BRAND_LOCKUP = {
  pdf: {
    height: 30,
    qapitaWidth: 85,
    nasppWidth: 87,
    dividerHeight: 19,
    gap: 14,
  },
  email: {
    height: 24,
    qapitaWidth: 67,
    nasppWidth: 70,
    dividerHeight: 16,
    gap: 10,
    mobileHeight: 20,
  },
} as const;
