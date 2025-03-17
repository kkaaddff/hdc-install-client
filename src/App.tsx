import ProTable, { ActionType, ProColumns } from '@ant-design/pro-table'
import { invoke } from '@tauri-apps/api/core'
import { Button, Card, Form, Input, message, Modal, Progress, Space, Spin, Tag } from 'antd'
import dayjs from 'dayjs'
import { useEffect, useRef, useState } from 'react'
import type { BuildEntity, BuildQueryParams } from './api'
import { getHarmonyConfig, queryBuilds } from './api'
import './App.css'

function App() {
  const actionRef = useRef<ActionType>()
  const [searchForm] = Form.useForm()
  const [baseUrl, setBaseUrl] = useState<string>('')
  const [installModalVisible, setInstallModalVisible] = useState<boolean>(false)
  const [selectedBuild, setSelectedBuild] = useState<BuildEntity | null>(null)
  const [installing, setInstalling] = useState<boolean>(false)
  const [installProgress, setInstallProgress] = useState<number>(0)

  // Fetch baseUrl from config when component mounts
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const baseUrl = await getHarmonyConfig()
        if (!baseUrl) {
          message.error('获取 baseUrl 失败，无法加载数据')
          return
        }
        setBaseUrl(baseUrl)
        // Trigger table reload when baseUrl is successfully set
        actionRef.current?.reload()
      } catch (error) {
        message.error('获取 baseUrl 失败')
      }
    }
    fetchConfig()
  }, [])

  const handleSearch = (values: any) => {
    console.log('Search form values:', values)
    actionRef.current?.reload()
  }

  const handleReset = () => {
    searchForm.resetFields()
    actionRef.current?.reload()
  }

  const handleInstall = (record: BuildEntity) => {
    setSelectedBuild(record)
    setInstallModalVisible(true)
  }

  const handleInstallModalCancel = () => {
    setInstallModalVisible(false)
    setSelectedBuild(null)
  }

  const simulateProgress = () => {
    setInstalling(true)
    setInstallProgress(0)

    // Simulate progress with faster initial progress and slower later progress
    let progress = 0
    const totalTime = 5 * 60 * 1000 // 5 minutes in milliseconds
    const interval = 1000 // Update every second
    const totalSteps = totalTime / interval

    // 添加超时标记
    let isTimedOut = false

    // 设置超时处理
    const timeoutId = setTimeout(() => {
      isTimedOut = true
      setInstallProgress(95) // 卡在95%
      message.warning('安装时间较长，请耐心等待...')
    }, totalTime)

    const timer = setInterval(() => {
      progress += 1

      // 如果已超时，不再更新进度
      if (isTimedOut) return

      // Calculate a non-linear progress that starts faster and slows down
      // First 70% of progress happens in first 40% of time
      const adjustedProgress =
        progress <= totalSteps * 0.4
          ? (progress / (totalSteps * 0.4)) * 70
          : 70 + ((progress - totalSteps * 0.4) / (totalSteps * 0.6)) * 30

      setInstallProgress(Math.min(Math.round(adjustedProgress), 95)) // 最高到95%，留5%给最终完成

      if (progress >= totalSteps) {
        clearInterval(timer)
      }
    }, interval)

    return { timer, timeoutId }
  }

  const handleInstallModalOk = async () => {
    try {
      if (!selectedBuild) {
        message.error('未选择构建记录')
        return
      }

      // Start progress simulation
      const { timer: progressTimer, timeoutId } = simulateProgress()

      // Call install API

      try {
        await handleExecute(selectedBuild.downloadUrl)

        // Complete the progress to 100% when API returns
        clearInterval(progressTimer)
        clearTimeout(timeoutId)
        setInstallProgress(100)

        setTimeout(() => {
          setInstalling(false)
          setInstallModalVisible(false)
          message.success('安装成功')
        }, 500)
      } catch (error) {
        clearInterval(progressTimer)
        clearTimeout(timeoutId)
        setInstalling(false)
        message.error('安装失败')
      }
    } catch (error) {
      // Form validation failed
      console.error('Form validation failed:', error)
    }
  }

  const columns: ProColumns<BuildEntity>[] = [
    {
      title: '应用名称',
      dataIndex: 'appName',
      width: 150,
    },
    {
      title: '构建类型',
      dataIndex: 'buildType',
      width: 120,
      valueEnum: {
        debug: { text: 'Debug', status: 'default' },
        release: { text: 'Release', status: 'success' },
      },
      render: (_, record) => (
        <Tag color={record.buildType === 'release' ? 'success' : 'default'}>{record.buildType}</Tag>
      ),
    },
    {
      title: '分支',
      dataIndex: 'branch',
      width: 150,
    },
    {
      title: '构建时间',
      dataIndex: 'buildTime',
      width: 180,
      hideInSearch: true,
      render: (_, record) => dayjs(record.buildTime).format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      title: '构建编号',
      dataIndex: 'buildNumber',
      width: 120,
      hideInSearch: true,
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      width: 180,
      hideInSearch: true,
      render: (_, record) => dayjs(record.createdAt).format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      title: '操作',
      width: 180,
      valueType: 'option',
      render: (_, record) => [
        <a
          key='download'
          onClick={() => {
            if (record.downloadUrl) {
              window.open(baseUrl + record.downloadUrl)
              message.success('开始下载')
            } else {
              message.error('文件路径不存在')
            }
          }}>
          下载
        </a>,
        <a key='install' onClick={() => handleInstall(record)}>
          安装
        </a>,
      ],
    },
  ]

  const handleExecute = async (downloadUrl: string) => {
    try {
      try {
        const result = await invoke('call_hdc', {
          download_url: downloadUrl,
        })
        message.success('执行成功')
        Modal.success({
          title: '执行结果',
          content: <pre>{result as string}</pre>,
        })
      } catch (error) {
        message.error(`执行失败: ${error}`)
      } finally {
      }
    } catch (error) {
      // 表单验证失败
    }
  }

  return (
    <div className='builds-management'>
      <Spin tip='安装中...' spinning={installing} fullscreen>
        <Card className='search-card'>
          <Form form={searchForm} onFinish={handleSearch} layout='inline'>
            <Form.Item name='appName' label='应用名称'>
              <Input placeholder='请输入应用名称' allowClear autoComplete='off' />
            </Form.Item>
            <Form.Item name='branch' label='分支'>
              <Input placeholder='请输入分支名称' allowClear autoComplete='off' />
            </Form.Item>
            <Form.Item>
              <Space>
                <Button type='primary' htmlType='submit' disabled={!baseUrl}>
                  查询
                </Button>
                <Button onClick={handleReset} disabled={!baseUrl}>
                  重置
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </Card>
        <Card className='table-card'>
          <ProTable<BuildEntity, BuildQueryParams>
            headerTitle='鸿蒙应用构建列表'
            actionRef={actionRef}
            rowKey='id'
            search={false}
            request={async (params) => {
              const { current, pageSize, ...rest } = params

              if (!baseUrl) {
                return {
                  data: [],
                  success: false,
                  total: 0,
                }
              }

              try {
                const response = await queryBuilds(
                  {
                    page: current,
                    pageSize,
                    ...rest,
                  },
                  baseUrl
                )
                return {
                  data: response.data.records,
                  success: true,
                  total: response.data.total,
                }
              } catch (error) {
                message.error('获取数据失败')
                return {
                  data: [],
                  success: false,
                  total: 0,
                }
              }
            }}
            columns={columns}
            pagination={{
              pageSize: 10,
            }}
          />
        </Card>

        {/* Install Modal */}
        <Modal
          title='安装应用'
          open={installModalVisible}
          onOk={handleInstallModalOk}
          onCancel={handleInstallModalCancel}
          confirmLoading={installing}
          cancelButtonProps={{ disabled: installing }}
          destroyOnClose
          className='install-modal'
          maskClosable={false}
          closable={false}>
          {installing ? (
            <div className='install-progress'>
              <Progress percent={installProgress} status='active' />
              <p>应用正在安装中，请耐心等待...</p>
            </div>
          ) : (
            <Form layout='vertical'>
              {selectedBuild && (
                <div className='install-info'>
                  <p>
                    <strong>应用名称:</strong> {selectedBuild.appName}
                  </p>
                  <p>
                    <strong>构建类型:</strong> {selectedBuild.buildType}
                  </p>
                  <p>
                    <strong>分支:</strong> {selectedBuild.branch}
                  </p>
                  <p>
                    <strong>构建编号:</strong> {selectedBuild.buildNumber}
                  </p>
                </div>
              )}
            </Form>
          )}
        </Modal>
      </Spin>
    </div>
  )
}

export default App
