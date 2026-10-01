import React from 'react'
import { Body, Container, Head, Hr, Html, Preview, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'

interface Props {
  name?: string
  subject?: string
  body?: string
  originalDate?: string
}

const InquiryReply = ({ name, body, originalDate }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>A reply to your inquiry</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={text}>{name ? `Hi ${name},` : 'Hi there,'}</Text>
        {(body ?? '').split(/\n{2,}/).map((p, i) => (
          <Text key={i} style={text}>{p}</Text>
        ))}
        <Hr style={hr} />
        <Text style={muted}>
          You're receiving this because you sent an inquiry{originalDate ? ` on ${originalDate}` : ''} through MYBEATCATALOG. Just reply to this email to continue the conversation.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: InquiryReply,
  subject: (d: Record<string, any>) => String(d['subject'] || 'Re: your inquiry'),
  displayName: 'Inquiry reply',
  previewData: { name: 'Jordan', subject: 'Re: your inquiry', body: 'Thanks for reaching out.\n\nHappy to help.', originalDate: 'Sep 30, 2026' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '24px 28px', maxWidth: '560px' }
const text = { fontSize: '15px', lineHeight: '1.6', color: '#1a1a1a', whiteSpace: 'pre-wrap' as const }
const muted = { fontSize: '12px', lineHeight: '1.5', color: '#6b6b6b' }
const hr = { borderColor: '#e5e5e5', margin: '24px 0' }
