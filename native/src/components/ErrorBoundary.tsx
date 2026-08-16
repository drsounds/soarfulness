// Neither this sandbox nor (per the user) the device being tested on has a
// way to read LogCat right now, so an uncaught render-time error anywhere in
// the tree would otherwise just be a silent black/blank screen with no way
// to tell what happened. This puts the error and its stack directly on
// screen instead, so it's visible without needing device logs at all.
import { Component, type ReactNode } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

type Props = { children: ReactNode };
type State = { error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <View style={styles.root}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.title}>Something crashed</Text>
          <Text style={styles.message}>{error.message}</Text>
          {error.stack ? <Text style={styles.stack}>{error.stack}</Text> : null}
        </ScrollView>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#1a0505", paddingTop: 60 },
  scroll: { padding: 16 },
  title: { color: "#fff", fontSize: 18, fontWeight: "600", marginBottom: 12 },
  message: { color: "#ff9c9c", fontSize: 14, marginBottom: 16 },
  stack: { color: "#e0a0a0", fontSize: 10, fontFamily: "monospace", lineHeight: 14 },
});
