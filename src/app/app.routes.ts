import { Routes } from '@angular/router';
import { SiteLayoutComponent } from './layout/site-layout/site-layout.component';
import { authGuard } from './shared/guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    component: SiteLayoutComponent,
    children: [
      { path: '', loadComponent: () => import('./features/home/home.component').then(m => m.HomeComponent) },
      { path: 'blog', loadComponent: () => import('./features/blog/blog.component').then(m => m.BlogComponent) },
      { path: 'videos', loadComponent: () => import('./features/videos/videos.component').then(m => m.VideosComponent) },
      { path: 'podcasts', loadComponent: () => import('./features/podcasts/podcasts.component').then(m => m.PodcastsComponent) },
      { path: 'podcasts/:id', loadComponent: () => import('./features/podcasts/podcast-detail.component').then(m => m.PodcastDetailComponent) },
      { path: 'metrics', loadComponent: () => import('./features/metrics/metrics.component').then(m => m.MetricsComponent) },
      { path: 'resources', loadComponent: () => import('./features/resources/resources.component').then(m => m.ResourcesComponent) },
      { path: 'about', loadComponent: () => import('./features/about/about.component').then(m => m.AboutComponent) },
      { path: 'planner', loadComponent: () => import('./features/planner/planner.component').then(m => m.PlannerComponent) },
      { path: 'admin', loadComponent: () => import('./features/admin/admin.component').then(m => m.AdminComponent) },
      {
        path: 'dashboard',
        loadComponent: () => import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent),
        canActivate: [authGuard],
        data: { roles: ['admin', 'tester', 'approver', 'reviewer'] },
      },
      {
        path: 'report',
        loadComponent: () => import('./features/report/report.component').then(m => m.ReportComponent),
        canActivate: [authGuard],
        data: { roles: ['admin', 'tester'] },
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
