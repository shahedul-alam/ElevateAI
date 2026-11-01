import { Document, Link, Page, StyleSheet, Text, View, pdf } from '@react-pdf/renderer'
import type { ReactNode } from 'react'

import { safeHref } from '@/lib/safe-href'
import { skillLabel, type ResumeModel } from './resume-model'

// Standard Helvetica only (see hasPdfUnsupportedChars): nothing to embed, and the text stays real,
// selectable text that applicant-tracking systems can read. A4, one column.
const styles = StyleSheet.create({
  page: { paddingVertical: 40, paddingHorizontal: 44, fontFamily: 'Helvetica', fontSize: 10, lineHeight: 1.35, color: '#111111' },
  name: { fontSize: 20, fontFamily: 'Helvetica-Bold' },
  // The gap under the name must be wide enough for text extraction to see two lines, not one.
  headline: { fontSize: 11.5, marginTop: 6 },
  meta: { marginTop: 4, color: '#333333' },
  section: { marginTop: 13 },
  heading: {
    fontSize: 9.5,
    fontFamily: 'Helvetica-Bold',
    // No letterSpacing: spaced-out capitals extract as "S U M M A R Y", which ATS parsers cannot
    // recognise as a section heading.
    color: '#111111',
    borderBottomWidth: 0.75,
    borderBottomColor: '#888888',
    paddingBottom: 2,
    marginBottom: 6,
  },
  item: { marginBottom: 7 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  bold: { fontFamily: 'Helvetica-Bold' },
  muted: { color: '#444444' },
  link: { color: '#111111', textDecoration: 'underline' },
  body: { marginTop: 2 },
})

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      {/* Keeps a heading from being stranded at the bottom of a page. */}
      <Text style={styles.heading} minPresenceAhead={36}>
        {title.toUpperCase()}
      </Text>
      {children}
    </View>
  )
}

export function ResumeDocument({ model }: { model: ResumeModel }) {
  return (
    <Document title={`${model.name} - Resume`} author={model.name}>
      <Page size="A4" style={styles.page}>
        <View>
          <Text style={styles.name}>{model.name}</Text>
          {model.headline ? <Text style={styles.headline}>{model.headline}</Text> : null}
          {model.contact.length > 0 ? <Text style={styles.meta}>{model.contact.join('  |  ')}</Text> : null}
          {model.links.map((l) => (
            <Text key={l.label} style={styles.meta}>
              {l.label}:{' '}
              <Link src={safeHref(l.url) ?? ''} style={styles.link}>
                {l.url}
              </Link>
            </Text>
          ))}
        </View>

        {model.summary ? (
          <Section title="Summary">
            <Text>{model.summary}</Text>
          </Section>
        ) : null}

        {model.skills.length > 0 ? (
          <Section title="Skills">
            <Text>{model.skills.map(skillLabel).join('  |  ')}</Text>
          </Section>
        ) : null}

        {model.experience.length > 0 ? (
          <Section title="Experience">
            {model.experience.map((e, i) => (
              <View key={i} style={styles.item} wrap={false}>
                <View style={styles.row}>
                  <Text style={styles.bold}>{[e.title, e.company].filter(Boolean).join(', ')}</Text>
                  <Text style={styles.muted}>{e.period}</Text>
                </View>
                {e.domain ? <Text style={styles.muted}>{e.domain}</Text> : null}
                {e.description ? <Text style={styles.body}>{e.description}</Text> : null}
              </View>
            ))}
          </Section>
        ) : null}

        {model.education.length > 0 ? (
          <Section title="Education">
            {model.education.map((e, i) => (
              <View key={i} style={styles.item} wrap={false}>
                <View style={styles.row}>
                  <Text style={styles.bold}>{e.heading}</Text>
                  <Text style={styles.muted}>{e.period}</Text>
                </View>
                {e.institution ? <Text>{e.institution}</Text> : null}
              </View>
            ))}
          </Section>
        ) : null}

        {model.certifications.length > 0 ? (
          <Section title="Certifications">
            {model.certifications.map((c) => (
              <Text key={c}>{`•  ${c}`}</Text>
            ))}
          </Section>
        ) : null}

        {model.additional.length > 0 ? (
          <Section title="Additional">
            {model.additional.map((line) => (
              <Text key={line}>{line}</Text>
            ))}
          </Section>
        ) : null}
      </Page>
    </Document>
  )
}

/** Builds the PDF in the browser and saves it. Loaded on demand (the PDF library is large). */
export async function downloadResumePdf(model: ResumeModel, filename: string) {
  const blob = await pdf(<ResumeDocument model={model} />).toBlob()
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  // Revoking straight away can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
