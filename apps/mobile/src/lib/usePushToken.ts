import { useEffect } from "react"
import * as Notifications from "expo-notifications"
import * as Device from "expo-device"
import { Platform } from "react-native"
import { trpc } from "./trpc"

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
})

export function usePushToken(userId: string | undefined) {
  const registerMutation = trpc.user.registerPushToken.useMutation()

  useEffect(() => {
    if (!userId) return
    void registerToken()

    async function registerToken() {
      if (!Device.isDevice) return
      const { status: existing } = await Notifications.getPermissionsAsync()
      const finalStatus =
        existing === "granted"
          ? existing
          : (await Notifications.requestPermissionsAsync()).status

      if (finalStatus !== "granted") return

      if (Platform.OS === "android") {
        await Notifications.setNotificationChannelAsync("default", {
          name: "default",
          importance: Notifications.AndroidImportance.MAX,
        })
      }

      const tokenData = await Notifications.getExpoPushTokenAsync()
      registerMutation.mutate({ token: tokenData.data })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])
}
