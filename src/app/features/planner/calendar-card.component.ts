// src/app/features/planner/calendar-card.component.ts
import { Component, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CalendarItem } from './planner.service';

@Component({
  selector: 'app-calendar-card',
  standalone: true,
  imports: [FormsModule],
  template: `
    @if (editing()) {
      <div class="card editing" [class]="'border-' + item().status">
        <select [(ngModel)]="editType" class="edit-field">
          <option value="blog">Blog</option>
          <option value="video">Video</option>
          <option value="short">Short</option>
          <option value="podcast">Podcast</option>
        </select>
        <input [(ngModel)]="editTitle" class="edit-field edit-title" placeholder="Title" />
        <input [(ngModel)]="editTopic" class="edit-field" placeholder="Topic" />
        <select [(ngModel)]="editLevel" class="edit-field">
          <option value="Beginner">Beginner</option>
          <option value="Intermediate">Intermediate</option>
          <option value="Advanced">Advanced</option>
          <option value="Professional">Professional</option>
        </select>
        <div class="card-actions">
          <button class="btn-save" (click)="saveEdit()">Save</button>
          <button class="btn-cancel" (click)="editing.set(false)">Cancel</button>
        </div>
      </div>
    } @else {
      <div class="card"
           [class]="'border-' + item().status"
           [attr.draggable]="true"
           (dragstart)="onDragStart($event)">
        <div class="card-header">
          <span class="type-badge" [class]="'badge-' + item().type">{{ item().type }}</span>
          <span class="status-dot" [class]="'dot-' + item().status"></span>
        </div>
        <div class="card-title">{{ item().title }}</div>
        <div class="card-tags">
          @if (item().topic) { <span class="tag">{{ item().topic }}</span> }
          @if (item().level) { <span class="tag tag-level">{{ item().level }}</span> }
        </div>
        @if (item().reasoning) {
          <div class="card-reasoning">{{ item().reasoning }}</div>
        }
        <div class="card-actions">
          <button class="btn-approve" title="Approve" (click)="onApprove()">&#10003;</button>
          <button class="btn-edit" title="Edit" (click)="startEdit()">&#9998;</button>
          <button class="btn-reject" title="Reject" (click)="onReject()">&#10005;</button>
        </div>
      </div>
    }
  `,
  styles: [`
    .card {
      background: #1e293b;
      border-radius: 8px;
      padding: 12px;
      margin-bottom: 8px;
      border-left: 3px solid #475569;
      cursor: grab;
      transition: border-color 0.2s, box-shadow 0.2s;
    }
    .card:hover { box-shadow: 0 2px 8px rgba(0,0,0,0.3); }
    .card.editing { cursor: default; }
    .border-proposed { border-left-color: #475569; }
    .border-approved { border-left-color: #22c55e; }
    .border-edited { border-left-color: #eab308; }
    .border-rejected { border-left-color: #ef4444; }
    .card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
    .type-badge {
      font-size: 10px; font-weight: 600; text-transform: uppercase; padding: 2px 6px; border-radius: 4px; color: white;
    }
    .badge-blog { background: #3b82f6; }
    .badge-video { background: #ef4444; }
    .badge-short { background: #f97316; }
    .badge-podcast { background: #a855f7; }
    .status-dot { width: 8px; height: 8px; border-radius: 50%; }
    .dot-proposed { background: #475569; }
    .dot-approved { background: #22c55e; }
    .dot-edited { background: #eab308; }
    .dot-rejected { background: #ef4444; }
    .card-title { font-size: 13px; font-weight: 500; color: #e2e8f0; margin-bottom: 6px; }
    .card-tags { display: flex; gap: 4px; flex-wrap: wrap; margin-bottom: 4px; }
    .tag {
      font-size: 10px; padding: 1px 6px; border-radius: 3px; background: #334155; color: #94a3b8;
    }
    .tag-level { background: #1e3a5f; color: #60a5fa; }
    .card-reasoning { font-size: 11px; color: #64748b; font-style: italic; margin-bottom: 6px; }
    .card-actions { display: flex; gap: 4px; }
    .card-actions button {
      flex: 1; padding: 4px; border: none; border-radius: 4px; cursor: pointer; font-size: 14px;
      background: #334155; color: #94a3b8; transition: background 0.15s;
    }
    .btn-approve:hover { background: #166534; color: #22c55e; }
    .btn-edit:hover { background: #713f12; color: #eab308; }
    .btn-reject:hover { background: #7f1d1d; color: #ef4444; }
    .btn-save { background: #166534 !important; color: #22c55e !important; }
    .btn-cancel { background: #334155 !important; }
    .edit-field {
      width: 100%; padding: 6px; margin-bottom: 4px; border: 1px solid #475569; border-radius: 4px;
      background: #0f172a; color: #e2e8f0; font-size: 12px;
    }
    .edit-title { font-weight: 500; }
  `],
})
export class CalendarCardComponent {
  item = input.required<CalendarItem>();
  itemApproved = output<CalendarItem>();
  itemRejected = output<CalendarItem>();
  itemUpdated = output<{ id: number; updates: Partial<CalendarItem> }>();
  dragStarted = output<{ event: DragEvent; item: CalendarItem }>();

  editing = signal(false);
  editTitle = '';
  editTopic = '';
  editLevel = '';
  editType = '';

  startEdit(): void {
    const i = this.item();
    this.editTitle = i.title;
    this.editTopic = i.topic ?? '';
    this.editLevel = i.level ?? 'Beginner';
    this.editType = i.type;
    this.editing.set(true);
  }

  saveEdit(): void {
    this.itemUpdated.emit({
      id: this.item().id,
      updates: {
        title: this.editTitle,
        topic: this.editTopic,
        level: this.editLevel,
        type: this.editType,
        status: 'edited',
      },
    });
    this.editing.set(false);
  }

  onApprove(): void {
    this.itemApproved.emit(this.item());
  }

  onReject(): void {
    this.itemRejected.emit(this.item());
  }

  onDragStart(event: DragEvent): void {
    this.dragStarted.emit({ event, item: this.item() });
  }
}
