import React from "react";
import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: "Helvetica",
    backgroundColor: "#ffffff",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
    alignItems: "flex-start",
  },
  title: {
    fontSize: 14,
    fontWeight: "bold",
    flex: 1,
    marginRight: 10,
    color: "#111111",
  },
  badge: {
    fontSize: 8,
    color: "#D6A85C",
    borderWidth: 1,
    borderColor: "#D6A85C",
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  divider: {
    borderTopWidth: 0.5,
    borderTopColor: "#cccccc",
    marginBottom: 16,
  },
  pointRow: {
    flexDirection: "row",
    marginBottom: 10,
  },
  pointNum: {
    fontSize: 10,
    width: 22,
    color: "#333333",
  },
  pointText: {
    fontSize: 10,
    flex: 1,
    lineHeight: 1.5,
    color: "#333333",
  },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
    borderTopWidth: 0.5,
    borderTopColor: "#cccccc",
    paddingTop: 8,
  },
  footerText: {
    fontSize: 7,
    color: "#888888",
    lineHeight: 1.4,
  },
});

type Props = {
  title: string;
  keyPoints: string[];
  date: string;
};

export function EquityBriefPDF({ title, keyPoints, date }: Props) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.badge}>DRAFT</Text>
        </View>
        <View style={styles.divider} />
        {keyPoints.map((point, index) => (
          <View key={index} style={styles.pointRow}>
            <Text style={styles.pointNum}>{index + 1}.</Text>
            <Text style={styles.pointText}>{point}</Text>
          </View>
        ))}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            {"Draft reference, not reviewed. Educational only, not advice. Qapita preview build. " +
              date}
          </Text>
        </View>
      </Page>
    </Document>
  );
}
