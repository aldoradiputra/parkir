package session

import (
	"encoding/json"
	"fmt"
	"time"

	"go.etcd.io/bbolt"
)

var (
	bucketSessions   = []byte("sessions")
	bucketPlateIdx   = []byte("plate_index")   // plate -> session ID (active only)
	bucketPhoneCache = []byte("phone_cache")    // plate -> phone (cached from cloud on entry)
)

// EdgeSession represents a parking session stored locally on the edge device.
type EdgeSession struct {
	ID             string    `json:"id"`
	Plate          string    `json:"plate"`
	VehicleType    string    `json:"vehicle_type"`
	EntryTime      time.Time `json:"entry_time"`
	ExitTime       *time.Time `json:"exit_time,omitempty"`
	Fee            int       `json:"fee,omitempty"`
	PaymentStatus  string    `json:"payment_status"` // "pending", "paid", "none"
	Synced         bool      `json:"synced"`
	CloudSessionID string    `json:"cloud_session_id,omitempty"`
	NotifyOnSync   bool     `json:"notify_on_sync,omitempty"`
	Phone          string   `json:"phone,omitempty"` // cached from cloud on entry
}

// Store provides BoltDB-backed persistence for edge sessions.
type Store struct {
	db *bbolt.DB
}

// NewStore opens or creates a BoltDB database at the given path and
// initialises the required buckets.
func NewStore(path string) (*Store, error) {
	db, err := bbolt.Open(path, 0600, &bbolt.Options{Timeout: 1 * time.Second})
	if err != nil {
		return nil, fmt.Errorf("open boltdb %s: %w", path, err)
	}

	err = db.Update(func(tx *bbolt.Tx) error {
		if _, err := tx.CreateBucketIfNotExists(bucketSessions); err != nil {
			return err
		}
		if _, err := tx.CreateBucketIfNotExists(bucketPlateIdx); err != nil {
			return err
		}
		if _, err := tx.CreateBucketIfNotExists(bucketPhoneCache); err != nil {
			return err
		}
		return nil
	})
	if err != nil {
		db.Close()
		return nil, fmt.Errorf("init buckets: %w", err)
	}

	return &Store{db: db}, nil
}

// Close releases the underlying BoltDB database.
func (s *Store) Close() error {
	return s.db.Close()
}

// SaveSession persists an EdgeSession. If the session has no ExitTime it is
// considered active and indexed by plate for fast lookup.
func (s *Store) SaveSession(sess *EdgeSession) error {
	data, err := json.Marshal(sess)
	if err != nil {
		return fmt.Errorf("marshal session: %w", err)
	}

	return s.db.Update(func(tx *bbolt.Tx) error {
		b := tx.Bucket(bucketSessions)
		if err := b.Put([]byte(sess.ID), data); err != nil {
			return err
		}

		idx := tx.Bucket(bucketPlateIdx)
		if sess.ExitTime == nil {
			// Active session: add to plate index.
			return idx.Put([]byte(sess.Plate), []byte(sess.ID))
		}
		// Completed session: remove from plate index if present.
		idx.Delete([]byte(sess.Plate))
		return nil
	})
}

// GetSession retrieves a session by its ID.
func (s *Store) GetSession(id string) (*EdgeSession, error) {
	var sess EdgeSession

	err := s.db.View(func(tx *bbolt.Tx) error {
		b := tx.Bucket(bucketSessions)
		data := b.Get([]byte(id))
		if data == nil {
			return fmt.Errorf("session %s not found", id)
		}
		return json.Unmarshal(data, &sess)
	})
	if err != nil {
		return nil, err
	}
	return &sess, nil
}

// FindActiveByPlate finds the active (no exit time) session for a given plate.
func (s *Store) FindActiveByPlate(plate string) (*EdgeSession, error) {
	var sess EdgeSession

	err := s.db.View(func(tx *bbolt.Tx) error {
		idx := tx.Bucket(bucketPlateIdx)
		sessID := idx.Get([]byte(plate))
		if sessID == nil {
			return fmt.Errorf("no active session for plate %s", plate)
		}

		b := tx.Bucket(bucketSessions)
		data := b.Get(sessID)
		if data == nil {
			return fmt.Errorf("session %s referenced by plate index not found", string(sessID))
		}
		return json.Unmarshal(data, &sess)
	})
	if err != nil {
		return nil, err
	}
	return &sess, nil
}

// GetUnsynced returns up to limit sessions that have not been synced to the cloud.
func (s *Store) GetUnsynced(limit int) ([]*EdgeSession, error) {
	var results []*EdgeSession

	err := s.db.View(func(tx *bbolt.Tx) error {
		b := tx.Bucket(bucketSessions)
		c := b.Cursor()

		for k, v := c.First(); k != nil && len(results) < limit; k, v = c.Next() {
			var sess EdgeSession
			if err := json.Unmarshal(v, &sess); err != nil {
				continue
			}
			if !sess.Synced {
				results = append(results, &sess)
			}
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return results, nil
}

// CachePhone stores a plate-to-phone mapping for offline exit notifications.
func (s *Store) CachePhone(plate, phone string) error {
	return s.db.Update(func(tx *bbolt.Tx) error {
		return tx.Bucket(bucketPhoneCache).Put([]byte(plate), []byte(phone))
	})
}

// GetCachedPhone retrieves the cached phone number for a plate, or empty string.
func (s *Store) GetCachedPhone(plate string) string {
	var phone string
	s.db.View(func(tx *bbolt.Tx) error {
		v := tx.Bucket(bucketPhoneCache).Get([]byte(plate))
		if v != nil {
			phone = string(v)
		}
		return nil
	})
	return phone
}

// MarkSynced marks the given session IDs as synced.
func (s *Store) MarkSynced(ids []string) error {
	return s.db.Update(func(tx *bbolt.Tx) error {
		b := tx.Bucket(bucketSessions)

		for _, id := range ids {
			data := b.Get([]byte(id))
			if data == nil {
				continue
			}

			var sess EdgeSession
			if err := json.Unmarshal(data, &sess); err != nil {
				continue
			}

			sess.Synced = true
			updated, err := json.Marshal(&sess)
			if err != nil {
				return fmt.Errorf("marshal session %s: %w", id, err)
			}
			if err := b.Put([]byte(id), updated); err != nil {
				return fmt.Errorf("put session %s: %w", id, err)
			}
		}
		return nil
	})
}
