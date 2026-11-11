import { Audiences, Faq, FinalCta, Hero, HowItWorks, LatestOpenings, Transparency } from '@/features/landing/sections'

export default function Home() {
  return (
    <main>
      <Hero />
      <HowItWorks />
      <Audiences />
      <LatestOpenings />
      <Transparency />
      <Faq />
      <FinalCta />
    </main>
  )
}
