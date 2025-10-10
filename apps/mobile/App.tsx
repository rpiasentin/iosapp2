import React, { useMemo, useState } from 'react';
import { Linking, StyleSheet } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { DashboardScreen } from './src/screens/DashboardScreen';
import { NavigationScreen } from './src/screens/NavigationScreen';
import { PlaceholderScreen } from './src/screens/PlaceholderScreen';
import { CombinedMathScreen } from './src/screens/CombinedMathScreen';
import { SetupScreen } from './src/screens/SetupScreen';
import { VrmDashboardScreen } from './src/screens/VrmDashboardScreen';

const REQUIRED_BASE_URL_MESSAGE =
  'Missing EXPO_PUBLIC_API_BASE_URL. Add it to app config or .env before running the app.';

type ActiveScreen =
  | { type: 'nav' }
  | { type: 'dashboard' }
  | { type: 'combinedMath' }
  | { type: 'setup' }
  | { type: 'vrmDashboard' }
  | { type: 'placeholder'; title: string; description?: string; link?: string };

export default function App() {
  const baseUrl = useMemo(() => {
    const value = process.env.EXPO_PUBLIC_API_BASE_URL;
    if (!value) {
      throw new Error(REQUIRED_BASE_URL_MESSAGE);
    }
    return value;
  }, []);

  const [active, setActive] = useState<ActiveScreen>({ type: 'nav' });

  const handleOpenDashboard = () => setActive({ type: 'dashboard' });
  const handleOpenCombinedMath = () => setActive({ type: 'combinedMath' });
  const handleOpenSetup = () => setActive({ type: 'setup' });
  const handleOpenVrmDashboard = () => setActive({ type: 'vrmDashboard' });
  const handleBackToNav = () => setActive({ type: 'nav' });
  const handlePlaceholder = (options: { title: string; description?: string; link?: string }) =>
    setActive({ type: 'placeholder', ...options });

  const openLink = async (url: string) => {
    const target = url.startsWith('http') ? url : `${baseUrl}${url.startsWith('/') ? '' : '/'}${url}`;
    const supported = await Linking.canOpenURL(target);
    if (supported) {
      await Linking.openURL(target);
    }
  };

  return (
    <SafeAreaProvider>
      <SafeAreaView edges={['top', 'right', 'left', 'bottom']} style={styles.safeArea}>
        {active.type === 'nav' ? (
          <NavigationScreen
            baseUrl={baseUrl}
            onOpenDashboard={handleOpenDashboard}
            onOpenCombinedMath={handleOpenCombinedMath}
            onOpenSetup={handleOpenSetup}
            onOpenVrmDashboard={handleOpenVrmDashboard}
            onShowPlaceholder={handlePlaceholder}
          />
        ) : null}
        {active.type === 'dashboard' ? (
          <DashboardScreen baseUrl={baseUrl} onBack={handleBackToNav} />
        ) : null}
        {active.type === 'combinedMath' ? (
          <CombinedMathScreen baseUrl={baseUrl} onBack={handleBackToNav} />
        ) : null}
        {active.type === 'setup' ? (
          <SetupScreen baseUrl={baseUrl} onBack={handleBackToNav} onOpenLink={openLink} />
        ) : null}
        {active.type === 'vrmDashboard' ? (
          <VrmDashboardScreen baseUrl={baseUrl} onBack={handleBackToNav} />
        ) : null}
        {active.type === 'placeholder' ? (
          <PlaceholderScreen
            title={active.title}
            description={active.description}
            link={active.link}
            onBack={handleBackToNav}
            onOpenLink={openLink}
          />
        ) : null}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f1f5f9',
  },
});
