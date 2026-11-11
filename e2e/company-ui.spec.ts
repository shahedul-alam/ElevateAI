import { ADMIN } from './support/auth'
import { createJobApi, uniqueTitle } from './support/jobs'
import {
  cardOf,
  closedJob,
  companyPayload,
  expect,
  getMyCompany,
  openCompanyViaNav,
  pngImage,
  publishJobWith,
  saveCompany,
  setVerified,
  signInUi,
  signOutUi,
  test,
  uploadImage,
  uniqueCompanyName,
} from './support/company'

const adminUser = { ...ADMIN, name: 'Admin' }
const thisYear = new Date().getFullYear()

test.describe('navbar', () => {
  test('shows Companies to anonymous visitors, without Company profile', async ({ page }) => {
    await page.goto('/')
    const bar = page.getByRole('banner')
    await expect(bar.getByRole('link', { name: 'Companies', exact: true })).toBeVisible()
    await expect(bar.getByRole('link', { name: 'Company profile' })).toHaveCount(0)
  })

  test('shows Companies to candidates, without Company profile', async ({ page, newCandidate }) => {
    const { user } = await newCandidate()
    await page.goto('/')
    await signInUi(page, user)
    const bar = page.getByRole('banner')
    await expect(bar.getByRole('link', { name: 'Companies', exact: true })).toBeVisible()
    await expect(bar.getByRole('link', { name: 'Company profile' })).toHaveCount(0)
  })

  test('shows Companies and Company profile to employers', async ({ page, newEmployer }) => {
    const { user } = await newEmployer()
    await page.goto('/')
    await signInUi(page, user)
    const bar = page.getByRole('banner')
    await expect(bar.getByRole('link', { name: 'Companies', exact: true })).toBeVisible()
    await bar.getByRole('link', { name: 'Company profile' }).click()
    await expect(page).toHaveURL(/\/employer\/company$/)
  })
})

test.describe('companies directory', () => {
  test('lists a company with generated initials, no badge and its open roles, and opens it', async ({
    page,
    newEmployer,
  }) => {
    const { api, user, company } = await newEmployer({ name: uniqueCompanyName('Orbit Labs') })
    await saveCompany(api, companyPayload(user.name, { tagline: 'Rockets for everyone' }))
    await page.goto('/companies')

    await page.getByLabel('Search companies').fill(user.name)
    await page.getByRole('button', { name: 'Search', exact: true }).click()

    const card = page.getByRole('main').getByRole('link', { name: user.name })
    await expect(card).toBeVisible()
    await expect(card.getByRole('img', { name: `${user.name} logo` })).toHaveText('OL')
    await expect(card).toContainText('Rockets for everyone')
    await expect(card).toContainText('0 open roles')
    await expect(card.getByText('Verified Employer')).toHaveCount(0)

    await publishJobWith(api)
    await page.reload()
    await page.getByLabel('Search companies').fill(user.name)
    await page.getByRole('button', { name: 'Search', exact: true }).click()
    await expect(card).toContainText('1 open role')
    await expect(card).not.toContainText('1 open roles')

    await card.click()
    await expect(page).toHaveURL(new RegExp(`/companies/${company.id}$`))
    await expect(page.getByRole('heading', { level: 1, name: user.name })).toBeVisible()
  })

  test('shows the Verified Employer badge only for a verified company', async ({ page, newEmployer, adminApi }) => {
    const prefix = uniqueCompanyName('Badge Check')
    const plain = await newEmployer({ name: `${prefix} Plain` })
    const verified = await newEmployer({ name: `${prefix} Verified` })
    await setVerified(adminApi, verified.company.id, true)

    await page.goto('/companies')
    await page.getByLabel('Search companies').fill(prefix)
    await page.getByRole('button', { name: 'Search', exact: true }).click()

    const main = page.getByRole('main')
    await expect(main.getByRole('link', { name: plain.user.name })).toBeVisible()
    await expect(main.getByRole('link', { name: verified.user.name }).getByText('Verified Employer')).toBeVisible()
    await expect(main.getByRole('link', { name: plain.user.name }).getByText('Verified Employer')).toHaveCount(0)
    // Verified companies come first.
    await expect(main.getByRole('listitem').first()).toContainText(verified.user.name)
  })

  test('searches by name ignoring case and shows an empty state', async ({ page, newEmployer }) => {
    const { user } = await newEmployer()
    await page.goto('/companies')

    await page.getByLabel('Search companies').fill(user.name.toUpperCase())
    await page.getByRole('button', { name: 'Search', exact: true }).click()
    await expect(page.getByRole('main').getByRole('link', { name: user.name })).toBeVisible()

    await page.getByLabel('Search companies').fill(`${user.name} no such company`)
    await page.getByRole('button', { name: 'Search', exact: true }).click()
    await expect(page.getByText('No companies match your search.')).toBeVisible()
  })

  test('filters by industry', async ({ page, newEmployer }) => {
    const { api, user } = await newEmployer()
    await saveCompany(api, companyPayload(user.name, { domainId: 'domain:saas' }))
    await page.goto('/companies')
    await page.getByLabel('Search companies').fill(user.name)
    await page.getByRole('button', { name: 'Search', exact: true }).click()
    const card = page.getByRole('main').getByRole('link', { name: user.name })
    await expect(card).toBeVisible()
    await expect(card).toContainText('SaaS')

    await page.getByLabel('Industry').selectOption({ label: 'Fintech' })
    await expect(page.getByText('No companies match your search.')).toBeVisible()
    await page.getByLabel('Industry').selectOption({ label: 'SaaS' })
    await expect(card).toBeVisible()
  })
})

test.describe('public company page', () => {
  test('an empty company says it has not added details and hides the empty sections', async ({
    page,
    newEmployer,
  }) => {
    const { user, company } = await newEmployer()
    await page.goto(`/companies/${company.id}`)

    await expect(page.getByRole('heading', { level: 1, name: user.name })).toBeVisible()
    await expect(page.getByText(`${user.name} has not added company details yet.`)).toBeVisible()
    for (const title of [
      `About ${user.name}`,
      'Our core mission',
      'Culture & principles',
      'Awards & recognition',
      'Candidate benefits & perks',
      'Global hubs & remote policy',
      'Social profiles',
    ]) {
      await expect(page.getByText(title, { exact: true })).toHaveCount(0)
    }
    await expect(page.getByText('No open positions right now.')).toBeVisible()
    await expect(page.getByText('Verified Employer')).toHaveCount(0)
  })

  test('shows every filled section', async ({ page, newEmployer }) => {
    const { api, user, company } = await newEmployer()
    await saveCompany(api, companyPayload(user.name))
    await page.goto(`/companies/${company.id}`)

    await expect(page.getByText('Building the future of hiring')).toBeVisible()
    await expect(page.getByText(`${user.name} has not added company details yet.`)).toHaveCount(0)
    for (const title of [
      `About ${user.name}`,
      'Our core mission',
      'Culture & principles',
      'Awards & recognition',
      'Candidate benefits & perks',
      'Global hubs & remote policy',
      'Social profiles',
    ]) {
      await expect(page.getByText(title, { exact: true })).toBeVisible()
    }
    await expect(page.getByText('We are a small team that cares about craft.')).toBeVisible()
    await expect(page.getByText('Make hiring fair for everyone.')).toBeVisible()
    await expect(page.getByText('Radical ownership')).toBeVisible()
    await expect(page.getByText('Best Places to Work')).toBeVisible()
    await expect(page.getByText('Health insurance')).toBeVisible()
    await expect(page.getByText('London, UK')).toBeVisible()
    for (const fact of ['Dhaka, Bangladesh', '51-200 employees', 'Series A', 'Est. 2015', 'SaaS', 'Hybrid']) {
      await expect(page.getByText(fact, { exact: true })).toBeVisible()
    }
  })

  test('shows only the sections that are filled in', async ({ page, newEmployer }) => {
    const { api, user, company } = await newEmployer()
    await saveCompany(api, { name: user.name, about: 'Only an about text.' })
    await page.goto(`/companies/${company.id}`)

    await expect(page.getByText(`About ${user.name}`, { exact: true })).toBeVisible()
    await expect(page.getByText('Only an about text.')).toBeVisible()
    await expect(page.getByText(`${user.name} has not added company details yet.`)).toHaveCount(0)
    for (const title of ['Our core mission', 'Culture & principles', 'Awards & recognition', 'Social profiles']) {
      await expect(page.getByText(title, { exact: true })).toHaveCount(0)
    }
  })

  test('lists open positions that link to the job and show the apply-by date', async ({ page, newEmployer }) => {
    const { api, company } = await newEmployer()
    const withDeadline = await publishJobWith(api, { applicationDeadline: '2099-12-15' })
    const plain = await publishJobWith(api)
    await page.goto(`/companies/${company.id}`)

    await expect(page.getByText('Open positions (2)')).toBeVisible()
    await expect(page.getByRole('link', { name: plain.title })).toBeVisible()
    const link = page.getByRole('link', { name: withDeadline.title })
    await expect(link).toContainText('Apply by')
    await expect(link).toContainText('2099')
    await expect(page.getByText('Direct ATS Matching')).toHaveCount(0)
    await expect(page.getByText('Accepting applicants')).toHaveCount(0)

    await link.click()
    await expect(page).toHaveURL(new RegExp(`/jobs/${withDeadline.id}$`))
    await expect(page.getByRole('heading', { name: withDeadline.title })).toBeVisible()
  })

  test('does not list draft or closed jobs', async ({ page, newEmployer }) => {
    const { api, company } = await newEmployer()
    const active = await publishJobWith(api)
    const draft = await createJobApi(api, { title: uniqueTitle('Hidden Draft') })
    const closed = await closedJob(api)
    await page.goto(`/companies/${company.id}`)
    await expect(page.getByRole('link', { name: active.title })).toBeVisible()
    await expect(page.getByText('Open positions (1)')).toBeVisible()
    await expect(page.getByText(draft.content.title)).toHaveCount(0)
    await expect(page.getByText(closed.content.title)).toHaveCount(0)
  })

  test('social links open in a new tab with rel noopener', async ({ page, newEmployer }) => {
    const { api, user, company } = await newEmployer()
    await saveCompany(api, companyPayload(user.name))
    await page.goto(`/companies/${company.id}`)

    for (const [name, href] of [
      ['Website', 'https://example.com'],
      ['LinkedIn', 'https://www.linkedin.com/company/example'],
      ['GitHub', 'https://github.com/example'],
      ['X / Twitter', 'https://x.com/example'],
    ]) {
      const chip = page.getByRole('link', { name: name!, exact: true })
      await expect(chip).toHaveAttribute('href', href!)
      await expect(chip).toHaveAttribute('target', '_blank')
      await expect(chip).toHaveAttribute('rel', /noopener/)
    }
    const visit = page.getByRole('link', { name: 'Visit' })
    await expect(visit).toHaveCount(3)
    for (const link of await visit.all()) {
      await expect(link).toHaveAttribute('target', '_blank')
      await expect(link).toHaveAttribute('rel', /noopener/)
    }
  })

  test('never renders an unsafe stored link as an anchor', async ({ page, newEmployer }) => {
    const { api, user, company } = await newEmployer()
    await saveCompany(api, companyPayload(user.name))
    // The API refuses such links, so simulate old or tampered stored data in the response.
    await page.route(`**/api/companies/${company.id}`, async (route) => {
      const response = await route.fetch()
      const body = await response.json()
      body.company.website = 'javascript:alert(1)'
      body.company.links = { linkedin: 'javascript:alert(2)', github: 'data:text/html,x', x: 'https://x.com/example' }
      await route.fulfill({ response, json: body })
    })
    await page.goto(`/companies/${company.id}`)

    await expect(page.getByRole('heading', { level: 1, name: user.name })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Website', exact: true })).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'LinkedIn', exact: true })).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'GitHub', exact: true })).toHaveCount(0)
    // The safe link next to them still renders.
    await expect(page.getByRole('link', { name: 'X / Twitter', exact: true })).toHaveAttribute(
      'href',
      'https://x.com/example',
    )
  })

  test('an unknown company shows a not-available message', async ({ page }) => {
    await page.goto('/companies/00000000-0000-4000-8000-000000000000')
    await expect(page.getByText('This company page is not available.')).toBeVisible()
    await page.goto('/companies/not-a-uuid')
    await expect(page.getByText('This company page is not available.')).toBeVisible()
  })
})

test.describe('company editor', () => {
  test('saves the profile and keeps it after a reload', async ({ page, newEmployer }) => {
    const { user } = await newEmployer()
    await page.goto('/')
    await signInUi(page, user)
    await page.getByRole('banner').getByRole('link', { name: 'Company profile' }).click()
    await expect(page.getByLabel('Company name')).toHaveValue(user.name)

    await page.getByLabel('Tagline').fill('We make hiring kind')
    await page.getByLabel('Headquarters').fill('Dhaka')
    await page.getByLabel('Founded (year)').fill('2016')
    await page.getByLabel('Company size').selectOption('51-200')
    await page.getByLabel('Funding stage').selectOption('Series A')
    await page.getByLabel('Industry').selectOption({ label: 'SaaS' })
    await page.getByLabel('Work policy').selectOption('hybrid')
    await page.getByLabel('About the company').fill('A longer story about us.')
    await page.getByLabel('Core mission').fill('Hire fairly.')
    await page.getByLabel('Website', { exact: true }).fill('https://acme.example.com')
    await page.getByLabel('LinkedIn', { exact: true }).fill('https://www.linkedin.com/company/acme')
    await page.getByLabel('GitHub', { exact: true }).fill('https://github.com/acme')
    await page.getByLabel('X / Twitter').fill('https://x.com/acme')
    await page.getByRole('button', { name: 'Save changes' }).click()
    await expect(page.getByText('Company profile saved')).toBeVisible()

    const saved = await page.request.get('/api/employer/company')
    expect((await saved.json()).company).toMatchObject({
      tagline: 'We make hiring kind',
      headquarters: 'Dhaka',
      foundedYear: 2016,
      size: '51-200',
      fundingStage: 'Series A',
      domainId: 'domain:saas',
      workPolicy: 'hybrid',
      about: 'A longer story about us.',
      mission: 'Hire fairly.',
      website: 'https://acme.example.com',
      links: {
        linkedin: 'https://www.linkedin.com/company/acme',
        github: 'https://github.com/acme',
        x: 'https://x.com/acme',
      },
    })

    await page.reload()
    await expect(page.getByLabel('Tagline')).toHaveValue('We make hiring kind')
    await expect(page.getByLabel('Founded (year)')).toHaveValue('2016')
    await expect(page.getByLabel('Company size')).toHaveValue('51-200')
    await expect(page.getByLabel('Industry')).toHaveValue('domain:saas')
    await expect(page.getByLabel('Work policy')).toHaveValue('hybrid')
    await expect(page.getByLabel('Website', { exact: true })).toHaveValue('https://acme.example.com')
  })

  test('adds, saves and removes culture, awards, benefits and hubs rows', async ({ page, newEmployer }) => {
    const { user } = await newEmployer()
    await page.goto('/')
    await signInUi(page, user)
    await page.goto('/employer/company')

    await cardOf(page, 'Culture & principles').getByRole('button', { name: 'Add' }).click()
    await page.getByLabel('Principle 1 title').fill('Ship it')
    await page.getByLabel('Principle 1 description').fill('Small steps, often')
    await cardOf(page, 'Culture & principles').getByRole('button', { name: 'Add' }).click()
    await page.getByLabel('Principle 2 title').fill('Be kind')

    await cardOf(page, 'Awards & recognition').getByRole('button', { name: 'Add' }).click()
    await page.getByLabel('Award 1 title').fill('Startup of the Year')
    await page.getByLabel('Award 1 issuer').fill('Tech Daily')
    await page.getByLabel('Award 1 year').fill('2021')

    await cardOf(page, 'Candidate benefits & perks').getByRole('button', { name: 'Add' }).click()
    await page.getByLabel('Candidate benefits & perks 1', { exact: true }).fill('Free lunch')
    await cardOf(page, 'Candidate benefits & perks').getByRole('button', { name: 'Add' }).click()
    await page.getByLabel('Candidate benefits & perks 2', { exact: true }).fill('Gym')

    await cardOf(page, 'Global hubs & remote policy').getByRole('button', { name: 'Add' }).click()
    await page.getByLabel('Global hubs & remote policy 1', { exact: true }).fill('Berlin')

    await page.getByRole('button', { name: 'Save changes' }).click()
    await expect(page.getByText('Company profile saved')).toBeVisible()
    let saved = (await (await page.request.get('/api/employer/company')).json()).company
    expect(saved.culture).toEqual([
      { title: 'Ship it', description: 'Small steps, often' },
      { title: 'Be kind', description: '' },
    ])
    expect(saved.awards).toEqual([{ title: 'Startup of the Year', issuer: 'Tech Daily', year: 2021 }])
    expect(saved.benefits).toEqual(['Free lunch', 'Gym'])
    expect(saved.hubs).toEqual(['Berlin'])

    await page.getByRole('button', { name: 'Remove principle 1' }).click()
    await page.getByRole('button', { name: 'Remove award 1' }).click()
    await page.getByRole('button', { name: 'Remove Candidate benefits & perks 1' }).click()
    await page.getByRole('button', { name: 'Remove Global hubs & remote policy 1' }).click()
    await expect(page.getByLabel('Principle 2 title')).toHaveCount(0)
    await page.getByRole('button', { name: 'Save changes' }).click()
    await expect(page.getByText('Company profile saved').last()).toBeVisible()

    await expect.poll(async () => {
      saved = (await (await page.request.get('/api/employer/company')).json()).company
      return [saved.culture.length, saved.awards.length, saved.benefits, saved.hubs]
    }).toEqual([1, 0, ['Gym'], []])
    expect(saved.culture[0].title).toBe('Be kind')
  })

  test('limits culture to 8 rows', async ({ page, newEmployer }) => {
    const { user } = await newEmployer()
    await page.goto('/')
    await signInUi(page, user)
    await page.goto('/employer/company')

    const add = cardOf(page, 'Culture & principles').getByRole('button', { name: 'Add' })
    for (let i = 0; i < 8; i++) await add.click()
    await expect(page.getByLabel('Principle 8 title')).toBeVisible()
    await expect(add).toBeDisabled()
  })

  test('shows validation errors for a bad link and a bad year and does not save', async ({ page, newEmployer }) => {
    const { user } = await newEmployer()
    await page.goto('/')
    await signInUi(page, user)
    await page.goto('/employer/company')

    await page.getByLabel('Website', { exact: true }).fill('javascript:alert(1)')
    await page.getByLabel('Founded (year)').fill('1700')
    await page.getByRole('button', { name: 'Save changes' }).click()

    await expect(page.getByText('Enter a full link starting with https://')).toBeVisible()
    await expect(page.getByText(`Enter a year between 1800 and ${thisYear}`)).toBeVisible()
    await expect(page.getByLabel('Website', { exact: true })).toHaveAttribute('aria-invalid', 'true')
    await expect(page.getByText('Company profile saved')).toHaveCount(0)

    const company = await getMyCompany(page.request)
    expect(company.website).toBe('')
    expect(company.foundedYear).toBeNull()

    await page.getByLabel('Founded (year)').fill('20x5')
    await page.getByRole('button', { name: 'Save changes' }).click()
    await expect(page.getByText('Enter a 4-digit year')).toBeVisible()
  })

  test('requires a company name', async ({ page, newEmployer }) => {
    const { user } = await newEmployer()
    await page.goto('/')
    await signInUi(page, user)
    await page.goto('/employer/company')
    await expect(page.getByLabel('Company name')).toHaveValue(user.name)

    await page.getByLabel('Company name').fill('')
    await page.getByRole('button', { name: 'Save changes' }).click()
    await expect(page.getByText('Company name is required')).toBeVisible()
    expect((await getMyCompany(page.request)).name).toBe(user.name)
  })

  test('validates an award year', async ({ page, newEmployer }) => {
    const { user } = await newEmployer()
    await page.goto('/')
    await signInUi(page, user)
    await page.goto('/employer/company')

    await cardOf(page, 'Awards & recognition').getByRole('button', { name: 'Add' }).click()
    await page.getByLabel('Award 1 title').fill('Old award')
    await page.getByLabel('Award 1 year').fill('1850')
    await page.getByRole('button', { name: 'Save changes' }).click()
    await expect(page.getByText(`Enter a year between 1900 and ${thisYear}`)).toBeVisible()
  })

  test('the Preview tab shows unsaved edits and the form keeps its input', async ({ page, newEmployer }) => {
    const { user } = await newEmployer()
    await page.goto('/')
    await signInUi(page, user)
    await page.goto('/employer/company')

    await page.getByLabel('Tagline').fill('An unsaved tagline')
    await page.getByLabel('About the company').fill('Unsaved about text')
    await page.getByRole('tab', { name: 'Preview' }).click()

    await expect(page.getByRole('tab', { name: 'Preview' })).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByText('An unsaved tagline')).toBeVisible()
    await expect(page.getByText('Unsaved about text')).toBeVisible()
    await expect(page.getByText('including your unsaved changes')).toBeVisible()
    expect((await getMyCompany(page.request)).tagline).toBe('')

    await page.getByRole('tab', { name: 'Edit' }).click()
    await expect(page.getByLabel('Tagline')).toHaveValue('An unsaved tagline')
    await expect(page.getByLabel('About the company')).toHaveValue('Unsaved about text')
  })

  test('the Preview tab survives a reload through ?tab=preview', async ({ page, newEmployer }) => {
    const { api, user } = await newEmployer()
    await saveCompany(api, companyPayload(user.name, { tagline: 'Saved tagline' }))
    await page.goto('/')
    await signInUi(page, user)
    await page.goto('/employer/company')

    await page.getByRole('tab', { name: 'Preview' }).click()
    await expect(page).toHaveURL(/\/employer\/company\?tab=preview$/)
    await page.reload()
    await expect(page.getByRole('tab', { name: 'Preview' })).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByText('Saved tagline')).toBeVisible()

    await page.getByRole('tab', { name: 'Edit' }).click()
    await expect(page).toHaveURL(/\/employer\/company$/)
    await expect(page.getByLabel('Tagline')).toBeVisible()
  })

  for (const kind of ['logo', 'cover'] as const) {
    test(`uploads and removes the ${kind}`, async ({ page, newEmployer }) => {
      const { user } = await newEmployer()
      await page.goto('/')
      await signInUi(page, user)
      await page.goto('/employer/company')

      const label = kind === 'logo' ? 'Logo' : 'Cover'
      // The file input is visually hidden and shares its label with the Upload button.
      const input = page.locator(`#${kind}-file`)
      await expect(page.getByRole('button', { name: 'Remove', exact: true })).toHaveCount(0)

      await input.setInputFiles({ name: `${kind}.png`, mimeType: 'image/png', buffer: pngImage() })
      await expect(page.getByText(`${label} updated`)).toBeVisible()
      await expect(page.getByRole('button', { name: 'Remove', exact: true })).toBeVisible()
      expect((await getMyCompany(page.request))[`${kind}Url`]).toMatch(/\?v=[0-9a-f]{16}$/)

      await page.getByRole('button', { name: 'Remove', exact: true }).click()
      await expect(page.getByText(`${label} removed`)).toBeVisible()
      await expect(page.getByRole('button', { name: 'Remove', exact: true })).toHaveCount(0)
      expect((await getMyCompany(page.request))[`${kind}Url`]).toBeNull()
    })
  }

  test('an uploaded logo appears on the public page', async ({ page, newEmployer }) => {
    const { api, user, company } = await newEmployer()
    await uploadImage(api, 'logo', pngImage())
    await page.goto(`/companies/${company.id}`)
    await expect(page.getByRole('img', { name: `${user.name} logo` })).toHaveAttribute(
      'src',
      new RegExp(`/api/companies/${company.id}/logo\\?v=[0-9a-f]{16}$`),
    )
  })

  test('rejects an unsupported file with a toast and uploads nothing', async ({ page, newEmployer }) => {
    const { user } = await newEmployer()
    await page.goto('/')
    await signInUi(page, user)
    await page.goto('/employer/company')

    await page.locator('#logo-file').setInputFiles({
      name: 'notes.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('not an image'),
    })
    await expect(page.getByText('Unsupported file')).toBeVisible()
    expect((await getMyCompany(page.request)).logoUrl).toBeNull()
  })

  test('rejects an oversize logo before uploading it', async ({ page, newEmployer }) => {
    const { user } = await newEmployer()
    await page.goto('/')
    await signInUi(page, user)
    await page.goto('/employer/company')

    await page.locator('#logo-file').setInputFiles({
      name: 'big.png',
      mimeType: 'image/png',
      buffer: Buffer.alloc(513 * 1024, 1),
    })
    await expect(page.getByText('File too large')).toBeVisible()
    expect((await getMyCompany(page.request)).logoUrl).toBeNull()
  })

  test('shows the server error when a file claims to be a PNG but is not', async ({ page, newEmployer }) => {
    const { user } = await newEmployer()
    await page.goto('/')
    await signInUi(page, user)
    await page.goto('/employer/company')

    await page.locator('#cover-file').setInputFiles({
      name: 'fake.png',
      mimeType: 'image/png',
      buffer: Buffer.from('plain text pretending to be a PNG'),
    })
    await expect(page.getByText('Upload failed')).toBeVisible()
    await expect(page.getByText('The file must be a PNG, JPEG or WebP image')).toBeVisible()
    expect((await getMyCompany(page.request)).coverUrl).toBeNull()
  })

  test('an unverified company is told the badge is granted after review', async ({ page, newEmployer }) => {
    const { user } = await newEmployer()
    await page.goto('/')
    await signInUi(page, user)
    await page.goto('/employer/company')
    await expect(page.getByText('The Verified Employer badge is granted by ElevateAI after a review.')).toBeVisible()
  })

  test('warns a verified company and renaming removes the badge from the public page', async ({
    page,
    newEmployer,
    adminApi,
  }) => {
    const { user, company } = await newEmployer()
    await setVerified(adminApi, company.id, true)
    await page.goto('/')
    await signInUi(page, user)

    await page.goto(`/companies/${company.id}`)
    await expect(page.getByText('Verified Employer')).toBeVisible()

    await page.goto('/employer/company')
    await expect(page.getByText(/Your company is verified\. Changing the company name, website or social links/)).toBeVisible()
    const newName = `${user.name} Renamed`
    await page.getByLabel('Company name').fill(newName)
    await page.getByRole('button', { name: 'Save changes' }).click()
    await expect(page.getByText('Company profile saved')).toBeVisible()

    await page.goto(`/companies/${company.id}`)
    await expect(page.getByRole('heading', { level: 1, name: newName })).toBeVisible()
    await expect(page.getByText('Verified Employer')).toHaveCount(0)
  })

  test('a verified company keeps its badge when only the tagline changes', async ({ page, newEmployer, adminApi }) => {
    const { user, company } = await newEmployer()
    await setVerified(adminApi, company.id, true)
    await page.goto('/')
    await signInUi(page, user)
    await page.goto('/employer/company')
    await page.getByLabel('Tagline').fill('Just a new tagline')
    await page.getByRole('button', { name: 'Save changes' }).click()
    await expect(page.getByText('Company profile saved')).toBeVisible()

    await page.goto(`/companies/${company.id}`)
    await expect(page.getByText('Just a new tagline')).toBeVisible()
    await expect(page.getByText('Verified Employer')).toBeVisible()
  })

  test('is limited to employers', async ({ page, newCandidate }) => {
    const { user } = await newCandidate()
    await page.goto('/')
    await signInUi(page, user)
    await page.goto('/employer/company')
    await expect(page.getByText('Company profiles are managed by employer accounts.')).toBeVisible()
    await expect(page.getByLabel('Company name')).toHaveCount(0)
  })

  test('sends anonymous visitors to the login page', async ({ page }) => {
    await page.goto('/employer/company')
    await expect(page).toHaveURL(/\/login$/)
  })
})

test.describe('company and jobs', () => {
  test('the job page shows the company and links to its profile, which links back to the job', async ({
    page,
    newEmployer,
  }) => {
    const { api, user, company } = await newEmployer()
    await saveCompany(api, companyPayload(user.name, { tagline: 'Hiring right now' }))
    await uploadImage(api, 'logo', pngImage())
    const job = await publishJobWith(api)

    await page.goto(`/jobs/${job.id}`)
    await expect(page.getByRole('heading', { level: 1, name: job.title })).toBeVisible()
    await expect(page.getByRole('img', { name: `${user.name} logo` })).toHaveAttribute('src', /\/logo\?v=/)
    await expect(page.getByText('Hiring right now')).toBeVisible()

    await page.getByRole('main').getByRole('link', { name: user.name, exact: true }).click()
    await expect(page).toHaveURL(new RegExp(`/companies/${company.id}$`))

    await page.getByRole('link', { name: job.title }).click()
    await expect(page).toHaveURL(new RegExp(`/jobs/${job.id}$`))

    await page.getByRole('link', { name: 'View company profile' }).click()
    await expect(page).toHaveURL(new RegExp(`/companies/${company.id}$`))
  })

  test('shows the verified badge next to the company on the job page', async ({ page, newEmployer, adminApi }) => {
    const { api, company } = await newEmployer()
    await setVerified(adminApi, company.id, true)
    const job = await publishJobWith(api)
    await page.goto(`/jobs/${job.id}`)
    await expect(page.getByText('Verified Employer')).toBeVisible()
  })

  test('on /jobs the company link opens the company and the title opens the job', async ({ page, newEmployer }) => {
    const { api, user, company } = await newEmployer()
    const job = await publishJobWith(api)

    const search = async () => {
      await page.goto('/jobs')
      await page.getByLabel('Search jobs').fill(job.title)
      await page.getByRole('button', { name: 'Search' }).click()
    }

    await search()
    await page.getByRole('link', { name: user.name, exact: true }).click()
    await expect(page).toHaveURL(new RegExp(`/companies/${company.id}$`))
    await expect(page.getByRole('heading', { level: 1, name: user.name })).toBeVisible()

    await search()
    await page.getByRole('link', { name: job.title }).click()
    await expect(page).toHaveURL(new RegExp(`/jobs/${job.id}$`))
  })
})

test.describe('company page actions by viewer (regression)', () => {
  test('the owner sees Edit profile and Post new role, a candidate in the same tab does not', async ({
    page,
    newEmployer,
    newCandidate,
  }) => {
    const owner = await newEmployer()
    const { user: candidate } = await newCandidate()
    await page.goto('/')

    await signInUi(page, owner.user)
    await openCompanyViaNav(page, owner.user.name)
    await expect(page.getByRole('link', { name: 'Edit profile' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Post new role' })).toBeVisible()

    await signOutUi(page, owner.user)
    await signInUi(page, candidate)
    await openCompanyViaNav(page, owner.user.name)
    await expect(page.getByRole('link', { name: 'Edit profile' })).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Post new role' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /verified|verification/i })).toHaveCount(0)

    // Same after a reload of the same URL.
    await page.reload()
    await expect(page.getByRole('heading', { level: 1, name: owner.user.name })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Edit profile' })).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Post new role' })).toHaveCount(0)
  })

  test('another employer never sees them on someone else\'s page', async ({ page, newEmployer }) => {
    const a = await newEmployer()
    const b = await newEmployer()
    await page.goto('/')
    await signInUi(page, b.user)

    // Their own page first, so their own company is loaded and cached before they look at A's.
    await openCompanyViaNav(page, b.user.name)
    await expect(page.getByRole('link', { name: 'Edit profile' })).toBeVisible()

    await openCompanyViaNav(page, a.user.name)
    await expect(page.getByRole('link', { name: 'Edit profile' })).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Post new role' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /verified|verification/i })).toHaveCount(0)
  })

  test('an employer who signs in after another employer sees the buttons only on their own page', async ({
    page,
    newEmployer,
  }) => {
    const a = await newEmployer()
    const b = await newEmployer()
    await page.goto('/')

    await signInUi(page, a.user)
    await openCompanyViaNav(page, a.user.name)
    await expect(page.getByRole('link', { name: 'Edit profile' })).toBeVisible()

    await signOutUi(page, a.user)
    await signInUi(page, b.user)
    await openCompanyViaNav(page, a.user.name)
    await expect(page.getByRole('link', { name: 'Edit profile' })).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Post new role' })).toHaveCount(0)
    await openCompanyViaNav(page, b.user.name)
    await expect(page.getByRole('link', { name: 'Edit profile' })).toBeVisible()
  })

  test('an anonymous visitor never sees them', async ({ page, newEmployer }) => {
    const { company, user } = await newEmployer()
    await page.goto(`/companies/${company.id}`)
    await expect(page.getByRole('heading', { level: 1, name: user.name })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Edit profile' })).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Post new role' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /verified|verification/i })).toHaveCount(0)
  })

  test('the Edit profile and Post new role buttons go to the right pages', async ({ page, newEmployer }) => {
    const { user, company } = await newEmployer()
    await page.goto('/')
    await signInUi(page, user)
    await openCompanyViaNav(page, user.name)
    await page.getByRole('link', { name: 'Edit profile' }).click()
    await expect(page).toHaveURL(/\/employer\/company$/)

    await page.goto(`/companies/${company.id}`)
    await page.getByRole('link', { name: 'Post new role' }).click()
    await expect(page).toHaveURL(/\/employer\/jobs\/new$/)
  })

  test('an admin sees neither button but can verify and unverify', async ({ page, newEmployer }) => {
    const { user } = await newEmployer()
    await page.goto('/')
    await signInUi(page, adminUser)
    await openCompanyViaNav(page, user.name)

    await expect(page.getByRole('link', { name: 'Edit profile' })).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Post new role' })).toHaveCount(0)
    await expect(page.getByText('Verified Employer')).toHaveCount(0)

    await page.getByRole('button', { name: 'Mark as verified' }).click()
    await expect(page.getByText('Company verified')).toBeVisible()
    await expect(page.getByText('Verified Employer')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Remove verification' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Mark as verified' })).toHaveCount(0)

    await page.getByRole('button', { name: 'Remove verification' }).click()
    await expect(page.getByText('Verification removed')).toBeVisible()
    await expect(page.getByText('Verified Employer')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Mark as verified' })).toBeVisible()
  })

  test('the verification persists for other visitors', async ({ page, newEmployer, request }) => {
    const { user, company } = await newEmployer()
    await page.goto('/')
    await signInUi(page, adminUser)
    await openCompanyViaNav(page, user.name)
    await page.getByRole('button', { name: 'Mark as verified' }).click()
    await expect(page.getByText('Company verified')).toBeVisible()

    const body = await (await request.get(`/api/companies/${company.id}`)).json()
    expect(body.company.verified).toBe(true)
  })
})

test.describe('cache reset when the user changes in one tab', () => {
  test("a candidate cannot reach the previous employer's editor or data", async ({
    page,
    newEmployer,
    newCandidate,
  }) => {
    const employer = await newEmployer()
    const { user: candidate } = await newCandidate()
    await saveCompany(employer.api, companyPayload(employer.user.name, { tagline: 'Private-ish tagline' }))
    await page.goto('/')

    await signInUi(page, employer.user)
    await page.getByRole('banner').getByRole('link', { name: 'Company profile' }).click()
    await expect(page.getByLabel('Tagline')).toHaveValue('Private-ish tagline')

    await signOutUi(page, employer.user)
    await signInUi(page, candidate)
    // Client-side navigation to the editor: no reload, so any leftover cache would still be in memory.
    await page.evaluate(() => {
      window.history.pushState({}, '', '/employer/company')
      window.dispatchEvent(new PopStateEvent('popstate'))
    })

    await expect(page.getByText('Company profiles are managed by employer accounts.')).toBeVisible()
    await expect(page.getByLabel('Company name')).toHaveCount(0)
    await expect(page.getByLabel('Tagline')).toHaveCount(0)
    await expect(page.getByText(employer.user.name)).toHaveCount(0)
    await expect(page.getByText('Private-ish tagline')).toHaveCount(0)
  })

  test("the next employer sees their own company in the editor, not the previous employer's", async ({
    page,
    newEmployer,
  }) => {
    const a = await newEmployer()
    const b = await newEmployer()
    await saveCompany(a.api, companyPayload(a.user.name, { tagline: 'Tagline of A' }))
    await page.goto('/')

    await signInUi(page, a.user)
    await page.getByRole('banner').getByRole('link', { name: 'Company profile' }).click()
    await expect(page.getByLabel('Company name')).toHaveValue(a.user.name)
    await expect(page.getByLabel('Tagline')).toHaveValue('Tagline of A')

    await signOutUi(page, a.user)
    await signInUi(page, b.user)
    await page.getByRole('banner').getByRole('link', { name: 'Company profile' }).click()
    await expect(page.getByLabel('Company name')).toHaveValue(b.user.name)
    await expect(page.getByLabel('Tagline')).toHaveValue('')
    await expect(page.getByText('Tagline of A')).toHaveCount(0)
  })
})
