import { DataSource } from 'typeorm';
import { Clip } from '../entities/clip.entity';
import { FavoriteTrack } from '../entities/favorite-track.entity';
import { ListenHistory } from '../entities/listen-history.entity';
import { Playlist } from '../entities/playlist.entity';
import { PlaylistTrack } from '../entities/playlist-track.entity';
import { Role } from '../entities/role.entity';
import { TrackTag } from '../entities/track-tag.entity';
import { User } from '../entities/user.entity';

/** Entities shared by the runtime DataSource and the TypeORM CLI. */
export const entities = [
  Role,
  User,
  Playlist,
  PlaylistTrack,
  FavoriteTrack,
  ListenHistory,
  TrackTag,
  Clip,
];

export function dataSourceOptions() {
  return {
    type: 'postgres' as const,
    host: process.env.POSTGRES_HOST ?? 'postgres',
    port: parseInt(process.env.POSTGRES_PORT ?? '5432', 10),
    username: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    database: process.env.POSTGRES_DB,
    entities,
    migrations: ['src/migrations/*.ts'],
    // Schema is owned by migrations, never auto-synced.
    synchronize: false,
  };
}

export const AppDataSource = new DataSource(dataSourceOptions());
