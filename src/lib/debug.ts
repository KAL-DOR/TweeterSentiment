import { supabase, TABLES } from './supabase'

/**
 * Debug utilities for troubleshooting database connections
 */
export class DebugService {
  /**
   * Test Supabase connection and table access
   */
  static async testConnection(): Promise<void> {
    console.log('🔍 Testing Supabase connection...')
    
    try {
      // Test basic connection by trying to access a known table
      const { data, error } = await supabase
        .from(TABLES.RAW_TWEETS)
        .select('tweet_id')
        .limit(1)

      if (error) {
        console.error('❌ Connection test failed:', error)
        return
      }

      console.log('✅ Supabase connection successful')
      console.log('📋 Raw tweets table accessible')

      // Test raw tweets table specifically
      await this.testRawTweetsTable()
      
      // Test processed tweets table
      await this.testProcessedTweetsTable()

    } catch (error) {
      console.error('❌ Connection test error:', error)
    }
  }

  /**
   * Test raw tweets table access
   */
  static async testRawTweetsTable(): Promise<void> {
    console.log(`🔍 Testing table: ${TABLES.RAW_TWEETS}`)
    
    try {
      // Test 1: Try with different query approaches
      console.log('🔍 Test 1: Basic select with limit')
      const { data: basicData, error: basicError } = await supabase
        .from(TABLES.RAW_TWEETS)
        .select('tweet_id, created_at, Content, Date')
        .limit(5)

      if (basicError) {
        console.error(`❌ Basic query error:`, basicError)
        console.error('Error details:', {
          message: basicError.message,
          details: basicError.details,
          hint: basicError.hint,
          code: basicError.code
        })
      } else {
        console.log(`✅ Basic query successful - fetched ${basicData?.length || 0} records`)
        if (basicData && basicData.length > 0) {
          console.log('📝 Basic query sample:', basicData[0])
        }
      }

      // Test 2: Try with RLS bypass (if possible)
      console.log('🔍 Test 2: Try with service role key approach')
      const { data: serviceData, error: serviceError } = await supabase
        .from(TABLES.RAW_TWEETS)
        .select('*')
        .limit(3)

      if (serviceError) {
        console.error(`❌ Service query error:`, serviceError)
      } else {
        console.log(`✅ Service query successful - fetched ${serviceData?.length || 0} records`)
        if (serviceData && serviceData.length > 0) {
          console.log('📝 Service query sample:', serviceData[0])
        }
      }

      // Test 3: Try count query
      console.log('🔍 Test 3: Count query')
      const { count, error: countError } = await supabase
        .from(TABLES.RAW_TWEETS)
        .select('*', { count: 'exact', head: true })

      if (countError) {
        console.error(`❌ Count query error:`, countError)
      } else {
        console.log(`📊 Count query result: ${count || 0} records`)
      }

      // Test 4: Try without any filters
      console.log('🔍 Test 4: No filters query')
      const { data: noFilterData, error: noFilterError } = await supabase
        .from(TABLES.RAW_TWEETS)
        .select('*')

      if (noFilterError) {
        console.error(`❌ No filter query error:`, noFilterError)
      } else {
        console.log(`✅ No filter query successful - fetched ${noFilterData?.length || 0} records`)
        if (noFilterData && noFilterData.length > 0) {
          console.log('📝 No filter sample:', noFilterData[0])
        }
      }

    } catch (error) {
      console.error(`❌ Error testing ${TABLES.RAW_TWEETS}:`, error)
    }
  }

  /**
   * Test processed tweets table access
   */
  static async testProcessedTweetsTable(): Promise<void> {
    console.log(`🔍 Testing table: ${TABLES.PROCESSED_TWEETS}`)
    
    try {
      const { data, error, count } = await supabase
        .from(TABLES.PROCESSED_TWEETS)
        .select('*', { count: 'exact', head: true })

      if (error) {
        console.error(`❌ Error accessing ${TABLES.PROCESSED_TWEETS}:`, error)
        console.error('Error details:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        })
        return
      }

      console.log(`✅ Table ${TABLES.PROCESSED_TWEETS} accessible`)
      console.log(`📊 Total records: ${count || 0}`)

    } catch (error) {
      console.error(`❌ Error testing ${TABLES.PROCESSED_TWEETS}:`, error)
    }
  }

  /**
   * Check environment variables
   */
  static checkEnvironment(): void {
    console.log('🔍 Checking environment variables...')
    
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY
    const huggingfaceKey = import.meta.env.VITE_HUGGINGFACE_API_KEY
    const n8nUrl = import.meta.env.VITE_N8N_WEBHOOK_URL

    console.log('📋 Environment status:')
    console.log(`  VITE_SUPABASE_URL: ${supabaseUrl ? '✅ Set' : '❌ Missing'}`)
    console.log(`  VITE_SUPABASE_ANON_KEY: ${supabaseKey ? '✅ Set' : '❌ Missing'}`)
    console.log(`  VITE_HUGGINGFACE_API_KEY: ${huggingfaceKey ? '✅ Set' : '❌ Missing'}`)
    console.log(`  VITE_N8N_WEBHOOK_URL: ${n8nUrl ? '✅ Set' : '❌ Missing'}`)

    if (supabaseUrl) {
      console.log(`  Supabase URL: ${supabaseUrl}`)
    }
  }

  /**
   * Run all debug checks
   */
  static async runAllChecks(): Promise<void> {
    console.log('🚀 Running all debug checks...')
    console.log('=' .repeat(50))
    
    this.checkEnvironment()
    console.log('')
    await this.testConnection()
    
    console.log('')
    console.log('=' .repeat(50))
    console.log('🏁 Debug checks completed')
  }
}
