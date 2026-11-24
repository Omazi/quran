import { StyleSheet, Text, View } from 'react-native';

/** Placeholder screen. The real home screen is delivered with the UI lot. */
export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Quran App</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: '600' },
});
