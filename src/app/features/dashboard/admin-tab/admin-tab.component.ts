import { Component, signal } from '@angular/core';
import { MatTabsModule } from '@angular/material/tabs';
import { CmsConfigComponent } from './cms-config.component';
import { AutomationControlsComponent } from './automation-controls.component';
import { PublishingQueueComponent } from './publishing-queue.component';
import { SocialQueueComponent } from './social-queue.component';
import { PipelineQueueComponent } from './pipeline-queue.component';

@Component({
  selector: 'app-admin-tab',
  standalone: true,
  imports: [
    MatTabsModule,
    CmsConfigComponent,
    AutomationControlsComponent,
    PublishingQueueComponent,
    SocialQueueComponent,
    PipelineQueueComponent,
  ],
  template: `
    <div class="admin-container">
      <mat-tab-group
        animationDuration="150ms"
        [selectedIndex]="activeTabIndex()"
        (selectedIndexChange)="activeTabIndex.set($event)"
        class="admin-tabs">

        <mat-tab label="Site Config">
          @if (activeTabIndex() === 0) {
            <app-cms-config />
          }
        </mat-tab>

        <mat-tab label="Automation">
          @if (activeTabIndex() === 1) {
            <app-automation-controls />
          }
        </mat-tab>

        <mat-tab label="Publishing Queue">
          @if (activeTabIndex() === 2) {
            <app-publishing-queue />
          }
        </mat-tab>

        <mat-tab label="Social Queue">
          @if (activeTabIndex() === 3) {
            <app-social-queue />
          }
        </mat-tab>

        <mat-tab label="Production Pipeline">
          @if (activeTabIndex() === 4) {
            <app-pipeline-queue />
          }
        </mat-tab>

      </mat-tab-group>
    </div>
  `,
  styles: [`
    .admin-container {
      padding: 0;
    }

    .admin-tabs {
      --mat-tab-header-active-label-text-color: #3b82f6;
      --mat-tab-header-active-indicator-color: #3b82f6;
      --mat-tab-header-inactive-label-text-color: #94a3b8;
    }

    ::ng-deep .admin-tabs .mat-mdc-tab-body-content {
      padding: 0 1rem;
      overflow: visible;
    }

    ::ng-deep .admin-tabs .mat-mdc-tab-header {
      border-bottom: 1px solid rgba(148, 163, 184, 0.15);
    }
  `],
})
export class AdminTabComponent {
  activeTabIndex = signal(0);
}
