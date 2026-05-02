import { useTranslation } from "react-i18next"
import { StubScreen } from "../../src/components/StubScreen"

export default function RewardsScreen() {
  const { t } = useTranslation("rewards")
  return <StubScreen title={t("title", "Rewards")} subtitle={t("common:comingSoon", "Coming soon")} />
}
