import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Playlist } from './playlist.entity';

@Entity('playlist_tracks')
export class PlaylistTrack {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Playlist)
  @JoinColumn({ name: 'playlist_id' })
  playlist: Playlist;

  @Column({ name: 'track_id', type: 'varchar' })
  trackId: string;

  @Column({ type: 'varchar' })
  title: string;

  @Column({ type: 'varchar' })
  artist: string;

  @Column({ name: 'thumbnail_url', type: 'varchar', nullable: true })
  thumbnailUrl: string | null;

  @Column({ type: 'int', nullable: true })
  duration: number | null;

  @CreateDateColumn({ name: 'added_at', type: 'timestamp' })
  addedAt: Date;
}
