/* eslint-disable jsx-a11y/alt-text */
import React from "react";
import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: {
    paddingTop: 34,
    paddingBottom: 78,
    paddingHorizontal: 34,
    fontFamily: "Helvetica",
    backgroundColor: "#ffffff",
  },
  header: {
    borderBottomWidth: 2,
    borderBottomColor: "#633EA5",
    marginBottom: 22,
    paddingBottom: 14,
  },
  headerTop: {
    paddingVertical: 4,
  },
  label: {
    fontSize: 9,
    color: "#633EA5",
    textTransform: "uppercase",
    letterSpacing: 1.4,
    fontWeight: 700,
  },
  title: {
    marginTop: 6,
    fontSize: 18,
    lineHeight: 1.35,
    fontWeight: 700,
    color: "#241A34",
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 10,
    backgroundColor: "#FFFFFF",
  },
  metaText: {
    fontSize: 9,
    color: "#6C6283",
  },
  content: {
    gap: 14,
  },
  section: {
    borderWidth: 1,
    borderColor: "#E5DCF6",
    borderRadius: 14,
    padding: 14,
    backgroundColor: "#FFFFFF",
  },
  sectionHeading: {
    fontSize: 11,
    color: "#633EA5",
    fontWeight: 700,
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  paragraph: {
    fontSize: 10.5,
    lineHeight: 1.65,
    color: "#372B4F",
    marginBottom: 7,
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: 1,
    borderTopColor: "#E5DCF6",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 34,
    paddingVertical: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  footerText: {
    fontSize: 8,
    color: "#6C6283",
    lineHeight: 1.4,
    maxWidth: 320,
  },
  footerBrandRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  separator: {
    width: 1,
    height: 16,
    backgroundColor: "#633EA5",
    marginHorizontal: 10,
  },
  nasppLogo: {
    height: 16,
    width: 54,
    objectFit: "contain",
  },
  qapitaLogo: {
    height: 18,
    width: 88,
    objectFit: "contain",
  },
});

type Props = {
  title: string;
  sections: Array<{
    heading?: string;
    paragraphs: string[];
  }>;
  date: string;
  nasppLogoSrc: string;
  qapitaLogoSrc: string;
};

export function EquityBriefPDF({
  title,
  sections,
  date,
  nasppLogoSrc,
  qapitaLogoSrc,
}: Props) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <Text style={styles.label}>EquityIQ reference</Text>
            <Text style={styles.title}>{title}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaText}>Prepared on {date}</Text>
          </View>
        </View>
        <View style={styles.content}>
          {sections.map((section, index) => (
            <View key={index} style={styles.section} wrap={false}>
              {section.heading ? (
                <Text style={styles.sectionHeading}>{section.heading}</Text>
              ) : null}
              {section.paragraphs.map((paragraph, paragraphIndex) => (
                <Text key={paragraphIndex} style={styles.paragraph}>
                  {paragraph}
                </Text>
              ))}
            </View>
          ))}
        </View>
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Endorsed by NASPP
          </Text>
          <View style={styles.footerBrandRow}>
            <Image src={qapitaLogoSrc} style={styles.qapitaLogo} />
            <View style={styles.separator} />
            <Image src={nasppLogoSrc} style={styles.nasppLogo} />
          </View>
        </View>
      </Page>
    </Document>
  );
}
