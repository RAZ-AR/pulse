import { useTranslation } from "react-i18next"
import { StubScreen } from "../../src/components/StubScreen"

export default function EarnScreen() {
  const { t } = useTranslation("common")
  return <StubScreen title={t("nav.earn", "Earn points")} subtitle={t("comingSoon", "Coming soon")} />
}
