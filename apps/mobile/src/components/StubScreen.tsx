import { Text, View, StyleSheet } from "react-native"
import { useTheme } from "../lib/theme"

export function StubScreen({ title, subtitle }: { title: string; subtitle?: string }) {
  const theme = useTheme()
  return (
    <View style={[s.container, { backgroundColor: theme.bg }]}>
      <Text style={[s.title, { color: theme.text }]}>{title}</Text>
      {subtitle ? <Text style={[s.subtitle, { color: theme.textSecondary }]}>{subtitle}</Text> : null}
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  title: { fontSize: 22, fontWeight: "700", marginBottom: 8 },
  subtitle: { fontSize: 14, textAlign: "center" },
})
