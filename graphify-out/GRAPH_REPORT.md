# Graph Report - /Users/amtoc/amtocbot-site  (2026-04-26)

## Corpus Check
- 143 files · ~179,587 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 606 nodes · 872 edges · 50 communities detected
- Extraction: 70% EXTRACTED · 30% INFERRED · 0% AMBIGUOUS · INFERRED: 260 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 39|Community 39]]
- [[_COMMUNITY_Community 40|Community 40]]
- [[_COMMUNITY_Community 41|Community 41]]
- [[_COMMUNITY_Community 42|Community 42]]
- [[_COMMUNITY_Community 43|Community 43]]
- [[_COMMUNITY_Community 44|Community 44]]
- [[_COMMUNITY_Community 45|Community 45]]
- [[_COMMUNITY_Community 46|Community 46]]
- [[_COMMUNITY_Community 47|Community 47]]
- [[_COMMUNITY_Community 48|Community 48]]
- [[_COMMUNITY_Community 49|Community 49]]

## God Nodes (most connected - your core abstractions)
1. `jsonResponse()` - 55 edges
2. `getSessionUser()` - 38 edges
3. `logAudit()` - 26 edges
4. `DashboardComponent` - 25 edges
5. `requirePermission()` - 22 edges
6. `DashboardService` - 19 edges
7. `onRequestGet()` - 17 edges
8. `onRequestPost()` - 17 edges
9. `LinuxInterpreter` - 17 edges
10. `AdminService` - 17 edges

## Surprising Connections (you probably didn't know these)
- `onRequestGet()` --calls--> `jsonResponse()`  [INFERRED]
  /Users/amtoc/amtocbot-site/functions/api/learn/[language]/[slug]/recordings.ts → /Users/amtoc/amtocbot-site/functions/api/_shared/auth.ts
- `onRequestGet()` --calls--> `getContentFromD1()`  [INFERRED]
  /Users/amtoc/amtocbot-site/functions/api/dashboard/issues/index.ts → /Users/amtoc/amtocbot-site/functions/api/_shared/auth.ts
- `onRequestGet()` --calls--> `jsonResponse()`  [INFERRED]
  /Users/amtoc/amtocbot-site/functions/api/content-stats.ts → /Users/amtoc/amtocbot-site/functions/api/_shared/auth.ts
- `onRequestPost()` --calls--> `jsonResponse()`  [INFERRED]
  /Users/amtoc/amtocbot-site/functions/api/learn/[language]/[slug]/recordings.ts → /Users/amtoc/amtocbot-site/functions/api/_shared/auth.ts
- `onRequestPost()` --calls--> `setSessionCookie()`  [INFERRED]
  /Users/amtoc/amtocbot-site/functions/api/auth/verify.ts → /Users/amtoc/amtocbot-site/functions/api/_shared/auth.ts

## Communities

### Community 0 - "Community 0"
Cohesion: 0.04
Nodes (59): isRateLimited(), onRequestPost(), onRequestPost(), onRequestPost(), applyConfigOverrides(), cleanExpiredSessions(), clearSessionCookie(), getClientIP() (+51 more)

### Community 1 - "Community 1"
Cohesion: 0.05
Nodes (5): AdminService, CmsConfigComponent, PipelineQueueComponent, PublishingQueueComponent, SocialQueueComponent

### Community 2 - "Community 2"
Cohesion: 0.06
Nodes (2): DashboardComponent, DashboardService

### Community 3 - "Community 3"
Cohesion: 0.08
Nodes (12): authGuard(), logAccessDenied(), AuthService, onRequestPatch(), onRequestPost(), LinuxInterpreter, onRequestPost(), onRequestPatch() (+4 more)

### Community 4 - "Community 4"
Cohesion: 0.05
Nodes (8): AboutComponent, BlogComponent, ContentService, HomeComponent, MetricsComponent, PodcastDetailComponent, PodcastsComponent, VideosComponent

### Community 5 - "Community 5"
Cohesion: 0.11
Nodes (18): RecordingFeedComponent, build_summary(), fetch_content_from_d1(), get_google_service(), main(), post_metrics_to_d1(), post_report(), Fetch YouTube stats for all videos/podcasts/shorts in content.json. (+10 more)

### Community 6 - "Community 6"
Cohesion: 0.11
Nodes (14): CalendarGridComponent, analyzeContent(), fetchHNTrends(), fetchRedditTrends(), generateItems(), onRequestPost(), fetchTrends(), onRequestPost() (+6 more)

### Community 7 - "Community 7"
Cohesion: 0.11
Nodes (4): RecordingComponent, ThemeService, STORAGE_KEY(), TutorialService

### Community 8 - "Community 8"
Cohesion: 0.15
Nodes (21): fmt_date(), gen_podcasts(), gen_stats(), gen_videos(), is_recent(), load_content(), main(), Return True if the date is within the last N days (for row highlighting). (+13 more)

### Community 9 - "Community 9"
Cohesion: 0.13
Nodes (2): PlannerComponent, PlannerService

### Community 10 - "Community 10"
Cohesion: 0.11
Nodes (2): MediaStudioService, MediaStudioTabComponent

### Community 11 - "Community 11"
Cohesion: 0.13
Nodes (4): currentWeekStartDate(), onRequestGet(), onRequestOptions(), onRequestPost()

### Community 12 - "Community 12"
Cohesion: 0.21
Nodes (3): LearnLessonComponent, LearnService, LearnTrackComponent

### Community 13 - "Community 13"
Cohesion: 0.14
Nodes (1): ReportComponent

### Community 14 - "Community 14"
Cohesion: 0.18
Nodes (1): AutomationControlsComponent

### Community 15 - "Community 15"
Cohesion: 0.31
Nodes (1): ReferralsTabComponent

### Community 16 - "Community 16"
Cohesion: 0.36
Nodes (1): LinuxPlaygroundComponent

### Community 17 - "Community 17"
Cohesion: 0.29
Nodes (1): TutorialComponent

### Community 18 - "Community 18"
Cohesion: 0.29
Nodes (1): CalendarCardComponent

### Community 19 - "Community 19"
Cohesion: 0.43
Nodes (1): AuditLogTabComponent

### Community 20 - "Community 20"
Cohesion: 0.33
Nodes (1): CodePlaygroundComponent

### Community 21 - "Community 21"
Cohesion: 0.47
Nodes (1): HtmlPlaygroundComponent

### Community 22 - "Community 22"
Cohesion: 0.4
Nodes (1): ReportIssueComponent

### Community 23 - "Community 23"
Cohesion: 0.6
Nodes (1): AdminComponent

### Community 24 - "Community 24"
Cohesion: 0.5
Nodes (1): FeedbackComponent

### Community 25 - "Community 25"
Cohesion: 0.67
Nodes (0): 

### Community 26 - "Community 26"
Cohesion: 0.67
Nodes (0): 

### Community 27 - "Community 27"
Cohesion: 0.67
Nodes (1): SiteLayoutComponent

### Community 28 - "Community 28"
Cohesion: 0.67
Nodes (1): PerformancePanelComponent

### Community 29 - "Community 29"
Cohesion: 0.67
Nodes (1): ResourcesComponent

### Community 30 - "Community 30"
Cohesion: 1.0
Nodes (0): 

### Community 31 - "Community 31"
Cohesion: 1.0
Nodes (0): 

### Community 32 - "Community 32"
Cohesion: 1.0
Nodes (1): App

### Community 33 - "Community 33"
Cohesion: 1.0
Nodes (0): 

### Community 34 - "Community 34"
Cohesion: 1.0
Nodes (1): LearnCatalogComponent

### Community 35 - "Community 35"
Cohesion: 1.0
Nodes (1): PlaygroundComponent

### Community 36 - "Community 36"
Cohesion: 1.0
Nodes (1): AdminTabComponent

### Community 37 - "Community 37"
Cohesion: 1.0
Nodes (1): ThemeToggleComponent

### Community 38 - "Community 38"
Cohesion: 1.0
Nodes (0): 

### Community 39 - "Community 39"
Cohesion: 1.0
Nodes (0): 

### Community 40 - "Community 40"
Cohesion: 1.0
Nodes (0): 

### Community 41 - "Community 41"
Cohesion: 1.0
Nodes (0): 

### Community 42 - "Community 42"
Cohesion: 1.0
Nodes (0): 

### Community 43 - "Community 43"
Cohesion: 1.0
Nodes (0): 

### Community 44 - "Community 44"
Cohesion: 1.0
Nodes (0): 

### Community 45 - "Community 45"
Cohesion: 1.0
Nodes (0): 

### Community 46 - "Community 46"
Cohesion: 1.0
Nodes (0): 

### Community 47 - "Community 47"
Cohesion: 1.0
Nodes (0): 

### Community 48 - "Community 48"
Cohesion: 1.0
Nodes (0): 

### Community 49 - "Community 49"
Cohesion: 1.0
Nodes (0): 

## Knowledge Gaps
- **23 isolated node(s):** `Fetch content list from /api/content (public endpoint).`, `Authenticate and return a Google API service.`, `Fetch YouTube stats for all videos/podcasts/shorts in content.json.`, `Fetch Blogger pageview stats.`, `Update the Video Metrics table in content-tracker.md with YouTube stats.` (+18 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Community 30`** (2 nodes): `onRequestPost()`, `refresh-metrics.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 31`** (2 nodes): `bootstrap()`, `main.server.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 32`** (2 nodes): `App`, `app.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 33`** (2 nodes): `initTheme()`, `app.config.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 34`** (2 nodes): `LearnCatalogComponent`, `learn-catalog.component.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 35`** (2 nodes): `PlaygroundComponent`, `playground.component.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 36`** (2 nodes): `AdminTabComponent`, `admin-tab.component.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 37`** (2 nodes): `ThemeToggleComponent`, `theme-toggle.component.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 38`** (1 nodes): `postbuild.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 39`** (1 nodes): `main.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 40`** (1 nodes): `server.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 41`** (1 nodes): `app.routes.server.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 42`** (1 nodes): `app.config.server.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 43`** (1 nodes): `app.routes.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 44`** (1 nodes): `csharp.curriculum.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 45`** (1 nodes): `java.curriculum.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 46`** (1 nodes): `linux.curriculum.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 47`** (1 nodes): `html.curriculum.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 48`** (1 nodes): `types.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 49`** (1 nodes): `content.model.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `onRequestGet()` connect `Community 6` to `Community 0`?**
  _High betweenness centrality (0.144) - this node is a cross-community bridge._
- **Why does `jsonResponse()` connect `Community 0` to `Community 11`, `Community 3`, `Community 6`?**
  _High betweenness centrality (0.141) - this node is a cross-community bridge._
- **Why does `AuthService` connect `Community 3` to `Community 2`?**
  _High betweenness centrality (0.105) - this node is a cross-community bridge._
- **Are the 53 inferred relationships involving `jsonResponse()` (e.g. with `onRequestGet()` and `onRequestGet()`) actually correct?**
  _`jsonResponse()` has 53 INFERRED edges - model-reasoned connections that need verification._
- **Are the 36 inferred relationships involving `getSessionUser()` (e.g. with `onRequestPost()` and `onRequestPost()`) actually correct?**
  _`getSessionUser()` has 36 INFERRED edges - model-reasoned connections that need verification._
- **Are the 24 inferred relationships involving `logAudit()` (e.g. with `onRequestPost()` and `onRequestPost()`) actually correct?**
  _`logAudit()` has 24 INFERRED edges - model-reasoned connections that need verification._
- **Are the 19 inferred relationships involving `requirePermission()` (e.g. with `onRequestGet()` and `onRequestPost()`) actually correct?**
  _`requirePermission()` has 19 INFERRED edges - model-reasoned connections that need verification._