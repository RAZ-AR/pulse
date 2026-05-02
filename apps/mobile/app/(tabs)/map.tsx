import { useTranslation } from "react-i18next"
import { StubScreen } from "../../src/components/StubScreen"

export default function MapScreen() {
  const { t } = useTranslation("common")
  return <StubScreen title={t("nav.map", "Map")} subtitle={t("comingSoon", "Coming soon")} />
}
