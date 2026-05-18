import QRCode from "qrcode"

/** Генерирует PNG буфер QR кода для ayoo offer */
export async function generateOfferQr(token: string): Promise<Buffer> {
  const url = `ayoo://offer/${token}`
  return QRCode.toBuffer(url, {
    errorCorrectionLevel: "M",
    width: 400,
    margin: 2,
    color: { dark: "#1a1a2e", light: "#ffffff" },
  })
}
