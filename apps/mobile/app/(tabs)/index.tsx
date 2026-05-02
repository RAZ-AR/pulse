import { useTranslation } from "react-i18next"
import { StubScreen } from "../../src/components/StubScreen"

export default function HomeScreen() {
  const { t } = useTranslation("common")
  return <StubScreen title="PULSE" subtitle={t("comingSoon", "Home screen — coming next")} />
}
