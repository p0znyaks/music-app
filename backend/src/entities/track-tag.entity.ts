import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from './user.entity';

@Entity('track_tags')
export class TrackTag {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'track_id', type: 'varchar' })
  trackId: string;

  @Column({ type: 'varchar' })
  title: string;

  @Column({ type: 'varchar' })
  artist: string;

  @Column({ name: 'thumbnail_url', type: 'varchar', nullable: true })
  thumbnailUrl: string | null;

  @Column({ type: 'varchar' })
  tag: string;

  @CreateDateColumn({ name: 'added_at', type: 'timestamp' })
  addedAt: Date;
}
