# OwnersClub · presentation catalog and rental sandbox

## Release candidate 30.9.2

The client catalog filters the two retired QA3041 records by their exact IDs. The administrative catalog continues to expose those records to current financial administrators. The filter applies to server-side Assistant comparisons, forecasts and recommendations. Financial statements, payment applications, payment plans and audit history continue to use their existing records.

Android Explore and Portfolio use the existing investment workflow response to determine whether to enable Invest. A closed payment plan can remain visible without enabling purchase. The read endpoint uses the same Demo capacity calculation as Demo submission, including reserved applications and active listings. Rented cards show Rented. Unavailable fields have explicit empty states.

For presentation materials, confirm the provenance of existing gallery images and their association with each property. The eight files returned for the four remaining properties contained three distinct assets. The Downtown and Damac galleries are identical and one file appears under all four properties. Use the prepared English copy only after the property owner confirms missing factual fields.

## Testers and virtual funding

The source list consists of confirmed human testers with ordinary investment accounts. Role alone does not establish tester status. Compare each candidate against a protected operator-maintained roster or a documented acceptance run. Exclude privileged, system, blocked and duplicate accounts. The review on 28 November 2026 identified ten active ordinary investors, one of whom matched the QA3041 run, and another four blocked registration records.

Provision one isolated Demo login in the dedicated QA environment for each approved human tester. Match the login in the protected roster and use Demo infrastructure for holdings and the virtual wallet. Do not copy ordinary credentials, change the ordinary wallet, or insert simulated ownership into the ordinary portfolio. Restrict the QA entry point to presentation routes and block withdrawal endpoints. Keep live payment providers and background jobs disabled.

Marina Rental Residence — Demo uses ID 755df843-3cad-46eb-86da-c3078288cb71. The synthetic value is USD 100,000, made up of 100 shares at USD 1,000. The virtual top-up and acquisition offset each other, producing one Demo holding of one share per tester without reducing their starting balance. Check the Demo journal before retrying a top-up. Reuse the purchase idempotency key. Refuse issuance exceeding 100 shares. Finish with a fully paid simulated plan and status rented.

For the presentation, a USD 1,000 monthly Demo rent assumption gives USD 10 per share. The existing Demo processor credits a Demo wallet once per property/month. The normal manual rent route performs an independent financial calculation and stays confined to synthetic data during testing.

Production data changes require a separate, expressly approved plan with verified isolation, recipients, amounts, audit and rollback. The normal wallet and shared production catalog do not provide an isolated path for this presentation.

Для подготовки демонстрации сначала выпускай и проверяй WebApp. Android-сборки, эмулятор, Metro и скриншоты запускай только по отдельному запросу.
