import ProTable, { ActionType, ProColumns } from '@ant-design/pro-table'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { Button, Card, Form, Input, message, Modal, Progress, Select, Space, Spin, Tag } from 'antd'
import dayjs from 'dayjs'
import { pickBy } from 'lodash-es'
import { useEffect, useRef, useState } from 'react'
import type { BuildEntity, BuildQueryParams } from './api'
import { getHarmonyConfig, queryBuilds } from './api'
import './App.css'

const { Option } = Select

function App() {
  const actionRef = useRef<ActionType>()
  const [searchForm] = Form.useForm()
  const [baseUrl, setBaseUrl] = useState<string>('')
  const [installModalVisible, setInstallModalVisible] = useState<boolean>(false)
  const [selectedBuild, setSelectedBuild] = useState<BuildEntity | null>(null)
  const [installing, setInstalling] = useState<boolean>(false)
  const [installProgress, setInstallProgress] = useState<number>(0)
  const [installOutput, setInstallOutput] = useState<string>('')
  const [installStatus, setInstallStatus] = useState<'idle' | 'running' | 'success' | 'failed'>(
    'idle'
  )
  const outputRef = useRef<HTMLPreElement>(null)

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const baseUrl = await getHarmonyConfig()
        if (!baseUrl) {
          throw new Error()
        }
        setBaseUrl(baseUrl)
      } catch (error: any) {
        message.error('获取 baseUrl 失败')
      }
    }
    fetchConfig()
  }, [])

  useEffect(() => {
    const unlisten = listen('hdc-output', (event) => {
      const output = event.payload as string
      setInstallOutput((prev) => prev + output)
    })
    return () => {
      unlisten.then((unlistenFn) => unlistenFn())
    }
  }, [])

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight
    }
  }, [installOutput])

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
    setInstallStatus('idle')
  }

  const handleInstallModalCancel = () => {
    if (installStatus === 'running') {
      message.warning('安装正在进行中，请等待完成')
      return
    }
    setInstallModalVisible(false)
    setSelectedBuild(null)
    setInstallOutput('')
    setInstallProgress(0)
    setInstallStatus('idle')
  }

  const handleInstallModalOk = async () => {
    try {
      if (!selectedBuild) {
        message.error('未选择构建记录')
        return
      }

      setInstalling(true)
      setInstallProgress(0)
      setInstallOutput('')
      setInstallStatus('running')

      let progress = 0
      const progressTimer = setInterval(() => {
        progress += 1

        const adjustedProgress =
          progress <= 40 ? (progress / 40) * 70 : 70 + ((progress - 40) / 60) * 25

        setInstallProgress(Math.min(Math.round(adjustedProgress), 95))
      }, 500)

      try {
        const [_, code] = await handleExecute(selectedBuild.downloadUrl)

        clearInterval(progressTimer)

        setInstallProgress(100)

        setTimeout(() => {
          if (code === 0) {
            message.success('安装成功', 5)
            setInstallStatus('success')
          } else {
            message.error('安装失败', 5)
            setInstallStatus('failed')
          }
          setInstalling(false)
        }, 500)
      } catch (error) {
        clearInterval(progressTimer)
        setInstalling(false)
        setInstallStatus('failed')
        message.error('安装失败', 5)
      }
    } catch (error) {
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
      width: 80,
      render: (_, record) => (
        <Tag
          color={
            record.buildType === 'release'
              ? 'error'
              : record.buildType === 'debug'
              ? 'success'
              : 'warning'
          }>
          {record.buildType}
        </Tag>
      ),
    },
    {
      title: '分支',
      dataIndex: 'branch',
      width: 250,
    },
    {
      title: '构建编号',
      dataIndex: 'buildNumber',
      width: 80,
      hideInSearch: true,
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      width: 150,
      hideInSearch: true,
      render: (_, record) => dayjs(record.createdAt).format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      title: '操作',
      width: 80,
      valueType: 'option',
      render: (_, record) => [
        <a key='install' onClick={() => handleInstall(record)}>
          安装
        </a>,
      ],
    },
  ]

  const handleExecute = async (downloadUrl: string): Promise<[string, number]> => {
    try {
      const result = await invoke<[string, number]>('call_hdc', {
        downloadUrl: 'https:' + baseUrl + downloadUrl,
      })

      return result
    } catch (error) {
      message.error(`执行失败: ${error}`)
      throw error
    }
  }

  return (
    <div className='builds-management'>
      <Spin tip='安装中...' spinning={installing}>
        <Card className='search-card'>
          <Form form={searchForm} onFinish={handleSearch} layout='inline'>
            <Form.Item name='appName' label='应用名称'>
              <Select placeholder='请选择应用名称' allowClear>
                <Option value='YMMShipper'>运满满货主</Option>
                <Option value='YMMDriver'>运满满司机</Option>
                <Option value='SSShipper'>省省货主</Option>
                <Option value='SSDriver'>省省司机</Option>
                <Option value='ColdShipper'>冷运货主</Option>
                <Option value='ColdDriver'>冷运司机</Option>
              </Select>
            </Form.Item>
            <Form.Item name='branch' label='分支'>
              <Input placeholder='请输入分支名称' allowClear autoComplete='off' />
            </Form.Item>
            <Form.Item name='buildType' label='构建类型'>
              <Select placeholder='请选择构建类型' allowClear style={{ width: 120 }}>
                <Option value='debug'>debug</Option>
                <Option value='rel_can'>rel_can(TF)</Option>
                <Option value='release'>release</Option>
              </Select>
            </Form.Item>
            <Form.Item>
              <Space>
                <Button type='primary' htmlType='submit'>
                  查询
                </Button>
                <Button onClick={handleReset}>重置</Button>
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
              const { current, pageSize } = params
              const values = searchForm.getFieldsValue()
              const truthValues = pickBy(values, Boolean)

              try {
                const response = await queryBuilds({
                  page: current,
                  pageSize,
                  ...truthValues,
                })
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
        <Modal
          title='安装应用'
          open={installModalVisible}
          onOk={handleInstallModalOk}
          onCancel={handleInstallModalCancel}
          confirmLoading={installing}
          okButtonProps={{ disabled: installStatus === 'success' }}
          cancelButtonProps={{ disabled: installing }}
          destroyOnClose={false}
          className='install-modal'
          maskClosable={false}
          closable={!installing}
          width={800}>
          {installStatus === 'running' ? (
            <div className='install-progress'>
              <Progress percent={installProgress} status='active' />
              <p>应用正在安装中，请耐心等待...</p>
              <div className='install-output'>
                <pre
                  ref={outputRef}
                  style={{
                    maxHeight: '300px',
                    overflow: 'auto',
                    background: '#f0f0f0',
                    padding: '10px',
                    borderRadius: '4px',
                  }}>
                  {installOutput}
                </pre>
              </div>
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
                  {installStatus !== 'idle' && (
                    <div className='install-output'>
                      <pre
                        ref={outputRef}
                        style={{
                          maxHeight: '300px',
                          overflow: 'auto',
                          background: '#f0f0f0',
                          padding: '10px',
                          borderRadius: '4px',
                        }}>
                        {installOutput}
                      </pre>
                    </div>
                  )}
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
